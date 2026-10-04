"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import type { Droit } from "@/lib/droits/catalogue";
import { refusDroit } from "@/lib/droits/garde";
import { estDoublon } from "@/lib/erreurs-pg";
import { tracer } from "@/lib/audit";

import {
  annulerBilletDans,
  changerStatutDepartDans,
  creerLigneDans,
  embarquerDans,
  programmerDepartDans,
  vendreBilletsDans,
} from "./creation";
import { billets, lignesTransport } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Resultat = { ok: true; message: string; numeros?: string[] } | { ok: false; message: string };

/**
 * Opération du module, droit vérifié et erreurs traduites. Nos messages sont
 * écrits pour l'utilisateur et remontent tels quels ; le reste (SQL, réseau)
 * reste au serveur.
 */
async function operer(
  droit: Droit,
  travail: (organizationId: string, userId: string) => Promise<Resultat>,
  doublon = "Ce code est déjà utilisé.",
): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit(droit);
  if (refus) return { ok: false, message: refus.erreur };

  try {
    const resultat = await travail(session.organizationId, session.userId);
    if (resultat.ok) {
      revalidatePath("/billetterie", "layout");
      revalidatePath("/comptabilite", "layout");
      revalidatePath("/");
    }
    return resultat;
  } catch (erreur) {
    if (estDoublon(erreur)) return { ok: false, message: doublon };
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 200;
    if (!lisible) console.error("Billetterie : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

const entier = (min: number) =>
  z
    .string()
    .trim()
    .transform((v) => Number(v.replace(/[\s  ]/g, "")))
    .pipe(z.number().int().min(min));

const schemaLigne = z.object({
  code: z.string().trim().min(2, "Indiquez le code de la ligne.").max(20),
  depart: z.string().trim().min(2, "Indiquez la ville de départ."),
  arrivee: z.string().trim().min(2, "Indiquez la ville d'arrivée."),
  dureeMinutes: entier(1),
  distanceKm: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().positive().nullable()),
  tarif: entier(0),
});

export async function creerLigne(donnees: FormData): Promise<Resultat> {
  return operer(
    "billetterie.depart.gerer",
    async (organizationId, userId) => {
      const analyse = schemaLigne.safeParse({
        code: donnees.get("code"),
        depart: donnees.get("depart"),
        arrivee: donnees.get("arrivee"),
        dureeMinutes: String(donnees.get("dureeMinutes") ?? ""),
        distanceKm: String(donnees.get("distanceKm") ?? ""),
        tarif: String(donnees.get("tarif") ?? ""),
      });
      if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
      const { code } = await db.transaction((tx) => creerLigneDans(tx, organizationId, analyse.data, userId));
      return { ok: true, message: `Ligne ${code} ouverte.` };
    },
    "Une ligne porte déjà ce code.",
  );
}

export async function basculerLigne(ligneId: string): Promise<Resultat> {
  return operer("billetterie.depart.gerer", async (organizationId) => {
    if (!UUID.test(ligneId)) return { ok: false, message: "Ligne introuvable." };
    const [ligne] = await db
      .update(lignesTransport)
      .set({ active: sql`not ${lignesTransport.active}`, updatedAt: new Date(), version: sql`${lignesTransport.version} + 1` })
      .where(and(eq(lignesTransport.id, ligneId), eq(lignesTransport.organizationId, organizationId)))
      .returning({ code: lignesTransport.code, active: lignesTransport.active });
    if (!ligne) return { ok: false, message: "Ligne introuvable." };
    await tracer({ action: ligne.active ? "ligne.reprendre" : "ligne.suspendre", entite: "ligne", entiteId: ligneId, apres: { code: ligne.code } });
    return { ok: true, message: ligne.active ? `${ligne.code} de nouveau desservie.` : `${ligne.code} suspendue.` };
  });
}

const schemaDepart = z.object({
  ligneId: z.string().regex(UUID, "Choisissez une ligne."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  heure: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide."),
  vehicule: z.string().trim().min(2, "Indiquez le véhicule."),
  rangees: z.coerce.number().int().min(1).max(30),
});

export async function programmerDepart(donnees: FormData): Promise<Resultat> {
  return operer("billetterie.depart.gerer", async (organizationId, userId) => {
    const analyse = schemaDepart.safeParse({
      ligneId: donnees.get("ligneId"),
      date: donnees.get("date"),
      heure: donnees.get("heure"),
      vehicule: donnees.get("vehicule"),
      rangees: donnees.get("rangees") ?? "15",
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    const { date, heure, ...reste } = analyse.data;
    // L'heure saisie est celle d'Abidjan, qui vit en UTC toute l'année.
    const partLe = new Date(`${date}T${heure}:00Z`);
    const { reference } = await db.transaction((tx) =>
      programmerDepartDans(tx, organizationId, { ...reste, partLe }, userId),
    );
    return { ok: true, message: `Départ ${reference} programmé.` };
  });
}

export async function changerStatutDepart(departId: string, vers: string, motif?: string): Promise<Resultat> {
  return operer(vers === "annule" ? "billetterie.billet.annuler" : "billetterie.depart.gerer", async (organizationId, userId) => {
    const statut = z.enum(["embarquement", "parti", "annule"]).safeParse(vers);
    if (!UUID.test(departId) || !statut.success) return { ok: false, message: "Demande invalide." };
    const { reference, touches } = await db.transaction((tx) =>
      changerStatutDepartDans(tx, organizationId, departId, statut.data, userId, motif),
    );
    const message = {
      embarquement: `${reference} : embarquement ouvert.`,
      parti: `${reference} parti${touches > 0 ? ` — ${touches} non présenté${touches > 1 ? "s" : ""}` : ""}.`,
      annule: `${reference} annulé — ${touches} billet${touches > 1 ? "s" : ""} remboursé${touches > 1 ? "s" : ""}.`,
    }[statut.data];
    return { ok: true, message };
  });
}

const schemaVente = z.object({
  departId: z.string().regex(UUID, "Choisissez un départ."),
  moyen: z.enum(["especes", "mobile_money", "banque"]),
  places: z
    .array(
      z.object({
        siege: z.string().regex(/^\d{1,2}[A-D]$/),
        nom: z.string().trim().min(2, "Indiquez le nom de chaque passager."),
        telephone: z.string().trim().max(30).optional(),
        piece: z.string().trim().max(40).optional(),
      }),
    )
    .min(1, "Choisissez au moins un siège.")
    .max(20),
});

export async function vendreBillets(vente: unknown): Promise<Resultat> {
  return operer(
    "billetterie.billet.vendre",
    async (organizationId, userId) => {
      const analyse = schemaVente.safeParse(vente);
      if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
      const { departId, moyen, places } = analyse.data;
      const { numeros, total } = await db.transaction((tx) =>
        vendreBilletsDans(
          tx,
          organizationId,
          {
            departId,
            moyen,
            sieges: places.map((p) => p.siege),
            passagers: places.map((p) => ({ nom: p.nom, telephone: p.telephone, piece: p.piece })),
          },
          userId,
        ),
      );
      return {
        ok: true,
        numeros,
        message: `${numeros.length > 1 ? "Billets" : "Billet"} ${numeros.join(", ")} émis — ${total.toLocaleString("fr-FR")} F encaissés.`,
      };
    },
    "Un de ces sièges vient d'être vendu. Rechargez le plan.",
  );
}

/** Contrôle à la montée, par numéro de billet (scanné ou saisi) ou par identifiant. */
export async function embarquer(reference: string): Promise<Resultat> {
  return operer("billetterie.billet.vendre", async (organizationId, userId) => {
    const saisie = reference.trim().toUpperCase();
    if (!saisie) return { ok: false, message: "Saisissez ou scannez le numéro du billet." };
    let id = UUID.test(saisie) ? saisie.toLowerCase() : null;
    if (!id) {
      const [billet] = await db
        .select({ id: billets.id })
        .from(billets)
        .where(and(eq(billets.organizationId, organizationId), eq(billets.numero, saisie)));
      if (!billet) return { ok: false, message: `Aucun billet ${saisie}.` };
      id = billet.id;
    }
    const billetId = id;
    const { numero, siege } = await db.transaction((tx) => embarquerDans(tx, organizationId, billetId, userId));
    return { ok: true, message: `${numero} — siège ${siege} : à bord.` };
  });
}

export async function annulerBillet(billetId: string, motif: string): Promise<Resultat> {
  return operer("billetterie.billet.annuler", async (organizationId, userId) => {
    if (!UUID.test(billetId) || motif.trim().length < 3) return { ok: false, message: "Indiquez le motif de l'annulation." };
    const { numero, ecriture } = await db.transaction((tx) =>
      annulerBilletDans(tx, organizationId, billetId, motif.trim(), userId),
    );
    return {
      ok: true,
      message: ecriture ? `${numero} annulé, recette contrepassée (${ecriture}).` : `${numero} annulé.`,
    };
  });
}
