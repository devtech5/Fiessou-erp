"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut, refusDroit } from "@/lib/droits/garde";
import { ajouterJours, heureLocale, instantLocal } from "@/modules/presences/calcul";

import { DUREES_RAPIDES, finRapide, heureEnMinutes, LISTE_STATUTS, STATUTS, type CleDuree, type Plage, type StatutPlanning } from "./calcul";
import { enregistrerCreneauDans, enregistrerHorairesDans, poserStatutDans, supprimerCreneauDans, terminerStatutDans, type Acteur } from "./creation";
import { fuseauEntreprise, horairesDe } from "./requetes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

async function contexte(): Promise<{ organizationId: string; acteur: Acteur } | { refus: string }> {
  const refus = await refusDroit("planning.utiliser");
  if (refus) return { refus: refus.erreur };
  const session = await exigerEntreprise();
  return { organizationId: session.organizationId, acteur: { userId: session.userId, gere: await peut("planning.gerer") } };
}

function lisible(erreur: unknown): string {
  const message = erreur instanceof Error ? erreur.message : "";
  if (message && !message.startsWith("Failed query") && message.length < 300) return message;
  console.error("Planning : opération refusée", erreur);
  return "L'opération n'a pas abouti. Réessayez.";
}

function rafraichir() {
  revalidatePath("/planning", "layout");
}

const texte = (d: FormData, champ: string) => {
  const v = d.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};

const schemaCreneau = z.object({
  id: z.string().regex(UUID).optional(),
  userId: z.string().regex(UUID).optional(),
  statut: z.enum(LISTE_STATUTS as [StatutPlanning, ...StatutPlanning[]], { message: "Choisissez un statut." }),
  jourDebut: z.string().regex(DATE_ISO, "Date de début manquante."),
  heureDebut: z.string().refine((h) => heureEnMinutes(h) !== null && h !== "24:00", "Heure de début illisible."),
  jourFin: z.string().regex(DATE_ISO, "Date de fin manquante."),
  heureFin: z.string().refine((h) => heureEnMinutes(h) !== null, "Heure de fin illisible."),
  lieu: z.string().max(160, "Lieu trop long : 160 caractères au plus.").optional(),
  note: z.string().max(500, "Note trop longue : 500 caractères au plus.").optional(),
});

/** Crée ou modifie un créneau. Les heures se lisent dans le fuseau de l'entreprise. */
export async function enregistrerCreneau(donnees: FormData): Promise<Resultat> {
  const c = await contexte();
  if ("refus" in c) return { ok: false, message: c.refus };

  const analyse = schemaCreneau.safeParse({
    id: texte(donnees, "id"),
    userId: texte(donnees, "userId"),
    statut: donnees.get("statut") ?? "",
    jourDebut: donnees.get("jourDebut") ?? "",
    heureDebut: donnees.get("heureDebut") ?? "",
    jourFin: texte(donnees, "jourFin") ?? donnees.get("jourDebut") ?? "",
    heureFin: donnees.get("heureFin") ?? "",
    lieu: texte(donnees, "lieu"),
    note: texte(donnees, "note"),
  });
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
  const d = analyse.data;

  const fuseau = await fuseauEntreprise(c.organizationId);
  const debut = instantLocal(d.jourDebut, d.heureDebut, fuseau);
  // « 24:00 » : minuit qui termine le jour, soit 00:00 du lendemain.
  const fin = d.heureFin === "24:00" ? instantLocal(ajouterJours(d.jourFin, 1), "00:00", fuseau) : instantLocal(d.jourFin, d.heureFin, fuseau);

  try {
    await db.transaction((tx) =>
      enregistrerCreneauDans(tx, c.organizationId, { id: d.id, userId: d.userId ?? c.acteur.userId, statut: d.statut, debut, fin, lieu: d.lieu, note: d.note }, c.acteur),
    );
    rafraichir();
    return { ok: true, message: d.id ? "Créneau modifié." : `Créneau « ${STATUTS[d.statut].libelle} » ajouté.` };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

export async function supprimerCreneau(creneauId: string): Promise<Resultat> {
  const c = await contexte();
  if ("refus" in c) return { ok: false, message: c.refus };
  if (!UUID.test(creneauId)) return { ok: false, message: "Créneau introuvable." };
  try {
    await db.transaction((tx) => supprimerCreneauDans(tx, c.organizationId, creneauId, c.acteur));
    rafraichir();
    return { ok: true, message: "Créneau supprimé." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

/** « En courses pour une heure » : un statut qui commence maintenant. */
export async function poserStatut(statut: string, duree: string, pourUserId?: string, lieu?: string): Promise<Resultat> {
  const c = await contexte();
  if ("refus" in c) return { ok: false, message: c.refus };
  if (!LISTE_STATUTS.includes(statut as StatutPlanning)) return { ok: false, message: "Statut inconnu." };
  if (!DUREES_RAPIDES.some((x) => x.cle === duree)) return { ok: false, message: "Durée inconnue." };
  if (pourUserId !== undefined && !UUID.test(pourUserId)) return { ok: false, message: "Membre introuvable." };
  const userId = pourUserId ?? c.acteur.userId;

  const [fuseau, horaires] = await Promise.all([fuseauEntreprise(c.organizationId), horairesDe(c.organizationId, [userId])]);
  const maintenant = new Date();
  const fin = finRapide(duree as CleDuree, maintenant, horaires.get(userId) ?? [], fuseau);
  try {
    const r = await db.transaction((tx) =>
      poserStatutDans(tx, c.organizationId, { userId, statut: statut as StatutPlanning, fin, lieu: lieu?.slice(0, 160) }, c.acteur, maintenant),
    );
    rafraichir();
    return { ok: true, message: `${STATUTS[statut as StatutPlanning].libelle} jusqu'à ${heureLocale(r.fin, fuseau)}.` };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

/** « Je suis de retour » : ce qui était en cours s'arrête maintenant. */
export async function terminerStatut(pourUserId?: string): Promise<Resultat> {
  const c = await contexte();
  if ("refus" in c) return { ok: false, message: c.refus };
  if (pourUserId !== undefined && !UUID.test(pourUserId)) return { ok: false, message: "Membre introuvable." };
  try {
    await db.transaction((tx) => terminerStatutDans(tx, c.organizationId, pourUserId ?? c.acteur.userId, c.acteur));
    rafraichir();
    return { ok: true, message: "Statut levé : les horaires habituels reprennent." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

const schemaPlages = z
  .array(z.object({ jour: z.number().int().min(1).max(7), debut: z.string(), fin: z.string() }))
  .max(70, "Trop de plages.");

/** Remplace la semaine type. Les heures arrivent en « HH:MM », comme saisies. */
export async function enregistrerHoraires(pourUserId: string | null, saisie: { jour: number; debut: string; fin: string }[]): Promise<Resultat> {
  const c = await contexte();
  if ("refus" in c) return { ok: false, message: c.refus };
  if (pourUserId !== null && !UUID.test(pourUserId)) return { ok: false, message: "Membre introuvable." };
  const analyse = schemaPlages.safeParse(saisie);
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };

  const plages: Plage[] = [];
  for (const p of analyse.data) {
    const debutMinutes = heureEnMinutes(p.debut);
    const finMinutes = heureEnMinutes(p.fin);
    if (debutMinutes === null || finMinutes === null) return { ok: false, message: "Heure illisible : écrivez-la comme 08:30." };
    plages.push({ jour: p.jour, debutMinutes, finMinutes });
  }
  try {
    await db.transaction((tx) => enregistrerHorairesDans(tx, c.organizationId, pourUserId ?? c.acteur.userId, plages, c.acteur));
    rafraichir();
    return { ok: true, message: plages.length ? "Horaires enregistrés." : "Horaires effacés." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}
