"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { organizations, paiementsAbonnement } from "@/db/schema";
import { tracerPour } from "@/lib/audit";
import { exigerSession } from "@/lib/auth/dal";
import { newId } from "@/lib/ids";

import { ajouterJours, formule, periodeCouverte } from "./calcul";
import { estAdminPlateforme } from "./garde";

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jour = (v: Date | string | null) => (v === null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const fr = (n: number) => n.toLocaleString("fr-FR");

/** Toute action de cette page exige un administrateur de la plateforme. */
async function admin(): Promise<{ email: string; userId: string } | null> {
  const s = await exigerSession();
  return estAdminPlateforme(s.email) ? { email: s.email!, userId: s.userId } : null;
}

const REFUS: Resultat = { ok: false, message: "Réservé aux administrateurs de la plateforme Fiessou." };

const schemaPaiement = z.object({
  plan: z.string().refine((p) => formule(p) !== null, "Formule inconnue."),
  montant: z.number().int(),
  mois: z.number().int().min(-24).max(36).refine((m) => m !== 0, "Nombre de mois invalide."),
  moyen: z.enum(["wave", "orange_money", "mtn_money", "moov_money", "virement", "especes", "autre"]),
  reference: z.string().trim().max(120).optional(),
  recuLe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Enregistre un paiement reçu et prolonge l'abonnement. Un nombre de mois
 * négatif corrige une erreur de saisie — la ligne fautive reste, la
 * correction s'ajoute.
 */
export async function enregistrerPaiement(organizationId: string, saisie: z.input<typeof schemaPaiement>): Promise<Resultat> {
  const a = await admin();
  if (!a) return REFUS;
  if (!UUID.test(organizationId)) return { ok: false, message: "Entreprise introuvable." };
  const analyse = schemaPaiement.safeParse(saisie);
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
  const p = analyse.data;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  try {
    const r = await db.transaction(async (tx) => {
      const [o] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).for("update");
      if (!o) throw new Error("Entreprise introuvable.");
      // Payer pendant l'essai ne fait pas perdre les jours d'essai restants.
      const paye = jour(o.payeJusquAu);
      const essai = o.status === "essai" ? jour(o.trialEndsAt) : null;
      const couvert = p.mois > 0 && essai && (!paye || essai > paye) ? essai : paye;
      const periode = periodeCouverte(couvert, aujourdhui, p.mois);
      await tx.insert(paiementsAbonnement).values({
        id: newId(),
        organizationId,
        plan: p.plan,
        montant: p.montant,
        mois: p.mois,
        moyen: p.moyen,
        reference: p.reference || null,
        recuLe: p.recuLe,
        couvreDu: periode.du,
        couvreAu: periode.au,
        enregistrePar: a.email,
      });
      await tx
        .update(organizations)
        .set({ payeJusquAu: periode.au, plan: p.plan, status: o.status === "resilie" ? "resilie" : "actif", updatedAt: new Date(), version: sql`${organizations.version} + 1` })
        .where(eq(organizations.id, organizationId));
      return { nom: o.name, au: periode.au };
    });
    await tracerPour(organizationId, a.userId, { action: "souscription.payer", entite: "organisation", entiteId: organizationId, apres: { ...p, couvreAu: r.au, par: a.email } });
    revalidatePath("/plateforme");
    return { ok: true, message: `${r.nom} : ${fr(p.montant)} F enregistrés, abonnement couvert jusqu'au ${r.au.split("-").reverse().join("/")}.` };
  } catch (erreur) {
    return { ok: false, message: erreur instanceof Error ? erreur.message : "Enregistrement refusé." };
  }
}

/** Suspendre (lecture seule immédiate), réactiver, ou prolonger l'essai. */
export async function changerStatut(organizationId: string, geste: "suspendre" | "reactiver" | "prolonger_essai", jours = 14): Promise<Resultat> {
  const a = await admin();
  if (!a) return REFUS;
  if (!UUID.test(organizationId)) return { ok: false, message: "Entreprise introuvable." };
  const [o] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!o) return { ok: false, message: "Entreprise introuvable." };

  const aujourdhui = new Date().toISOString().slice(0, 10);
  let valeurs: Partial<typeof organizations.$inferInsert>;
  let message: string;
  if (geste === "suspendre") {
    valeurs = { status: "suspendu" };
    message = `${o.name} suspendue : lecture seule immédiate.`;
  } else if (geste === "reactiver") {
    valeurs = { status: o.payeJusquAu ? "actif" : "essai" };
    message = `${o.name} réactivée.`;
  } else {
    if (!Number.isInteger(jours) || jours < 1 || jours > 90) return { ok: false, message: "Entre 1 et 90 jours." };
    const base = jour(o.trialEndsAt);
    const fin = ajouterJours(base && base > aujourdhui ? base : aujourdhui, jours);
    valeurs = { trialEndsAt: new Date(`${fin}T23:59:59Z`), status: o.status === "suspendu" ? "suspendu" : o.status };
    message = `${o.name} : essai prolongé jusqu'au ${fin.split("-").reverse().join("/")}.`;
  }
  await db.update(organizations).set({ ...valeurs, updatedAt: new Date(), version: sql`${organizations.version} + 1` }).where(eq(organizations.id, organizationId));
  await tracerPour(organizationId, a.userId, { action: `souscription.${geste}`, entite: "organisation", entiteId: organizationId, apres: { ...valeurs, par: a.email } });
  revalidatePath("/plateforme");
  return { ok: true, message };
}
