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
  annulerContratDans,
  creerRessourceDans,
  enregistrerPassageDans,
  inscrireAdherentDans,
  remettreDans,
  reserverDans,
  restituerDans,
} from "./creation";
import { ressources } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MOYEN = z.enum(["especes", "mobile_money", "banque"]);

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

/**
 * Opération du module, droit vérifié et erreurs traduites. Nos messages sont
 * écrits pour l'utilisateur et remontent tels quels ; le reste (SQL, réseau)
 * reste au serveur.
 */
async function operer(
  droit: Droit,
  travail: (organizationId: string, userId: string) => Promise<Resultat>,
): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit(droit);
  if (refus) return { ok: false, message: refus.erreur };

  try {
    const resultat = await travail(session.organizationId, session.userId);
    if (resultat.ok) {
      revalidatePath("/reservations", "layout");
      revalidatePath("/comptabilite", "layout");
      revalidatePath("/");
    }
    return resultat;
  } catch (erreur) {
    if (estDoublon(erreur)) return { ok: false, message: "Ce code est déjà utilisé." };
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 200;
    if (!lisible) console.error("Réservations : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

/** « 15 000 » → 15000 ; vide → null. */
const montantOptionnel = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace(/[\s  ]/g, ""))))
  .pipe(z.number().int().min(0).nullable());

const schemaRessource = z.object({
  designation: z.string().trim().min(2, "Indiquez la désignation."),
  type: z.enum(["equipement", "chambre", "salle", "creneau"]),
  categorie: z.string().trim().max(60).optional(),
  quantite: z.coerce.number().int().positive("La quantité doit être positive."),
  tarifJour: montantOptionnel,
  tarifSemaine: montantOptionnel,
  tarifMois: montantOptionnel,
  caution: montantOptionnel,
});

export async function creerRessource(donnees: FormData): Promise<Resultat> {
  return operer("reservation.ressource.gerer", async (organizationId, userId) => {
    const analyse = schemaRessource.safeParse({
      designation: donnees.get("designation"),
      type: donnees.get("type") ?? "equipement",
      categorie: String(donnees.get("categorie") ?? "") || undefined,
      quantite: donnees.get("quantite") ?? "1",
      tarifJour: String(donnees.get("tarifJour") ?? ""),
      tarifSemaine: String(donnees.get("tarifSemaine") ?? ""),
      tarifMois: String(donnees.get("tarifMois") ?? ""),
      caution: String(donnees.get("caution") ?? ""),
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };

    const { code } = await db.transaction((tx) =>
      creerRessourceDans(
        tx,
        organizationId,
        { ...analyse.data, caution: analyse.data.caution ?? 0 },
        userId,
      ),
    );
    return { ok: true, message: `${code} ajoutée au parc.` };
  });
}

export async function changerStatutRessource(
  ressourceId: string,
  statut: "active" | "maintenance" | "retiree",
): Promise<Resultat> {
  return operer("reservation.ressource.gerer", async (organizationId) => {
    if (!UUID.test(ressourceId)) return { ok: false, message: "Ressource introuvable." };
    const [modifiee] = await db
      .update(ressources)
      .set({ statut, updatedAt: new Date(), version: sql`${ressources.version} + 1` })
      .where(and(eq(ressources.id, ressourceId), eq(ressources.organizationId, organizationId)))
      .returning({ code: ressources.code });
    if (modifiee) {
      await tracer({ action: "ressource.statut", entite: "ressource", entiteId: ressourceId, apres: { code: modifiee.code, statut } });
    }
    return modifiee
      ? { ok: true, message: `${modifiee.code} : état mis à jour.` }
      : { ok: false, message: "Ressource introuvable." };
  });
}

const schemaContrat = z.object({
  ressourceId: z.string().regex(UUID, "Choisissez une ressource."),
  clientId: z.string().regex(UUID, "Choisissez un client."),
  quantite: z.coerce.number().int().positive(),
  debut: z.string().regex(DATE_ISO, "Date de début invalide."),
  fin: z.string().regex(DATE_ISO, "Date de fin invalide."),
  notes: z.string().trim().max(300).optional(),
});

export async function reserver(donnees: FormData): Promise<Resultat> {
  return operer("reservation.contrat.gerer", async (organizationId, userId) => {
    const analyse = schemaContrat.safeParse({
      ressourceId: donnees.get("ressourceId"),
      clientId: donnees.get("clientId"),
      quantite: donnees.get("quantite") ?? "1",
      debut: donnees.get("debut"),
      fin: donnees.get("fin"),
      notes: String(donnees.get("notes") ?? "") || undefined,
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };

    const { numero, montant } = await db.transaction((tx) =>
      reserverDans(tx, organizationId, analyse.data, userId),
    );
    return { ok: true, message: `${numero} réservé : ${montant.toLocaleString("fr-FR")} F.` };
  });
}

export async function remettre(contratId: string, moyen: string): Promise<Resultat> {
  return operer("reservation.contrat.gerer", async (organizationId, userId) => {
    const m = MOYEN.safeParse(moyen);
    if (!UUID.test(contratId) || !m.success) return { ok: false, message: "Demande invalide." };
    const { ecriture } = await db.transaction((tx) => remettreDans(tx, organizationId, contratId, m.data, userId));
    return { ok: true, message: `Bien remis, location et caution encaissées (écriture ${ecriture}).` };
  });
}

export async function restituer(
  contratId: string,
  etat: string,
  retenue: number,
): Promise<Resultat> {
  return operer("reservation.contrat.gerer", async (organizationId, userId) => {
    const e = z.enum(["bon", "endommage", "perdu"]).safeParse(etat);
    if (!UUID.test(contratId) || !e.success || !Number.isInteger(retenue) || retenue < 0) {
      return { ok: false, message: "Constat invalide." };
    }
    const { ecriture } = await db.transaction((tx) =>
      restituerDans(tx, organizationId, contratId, { etat: e.data, retenue }, userId),
    );
    return {
      ok: true,
      message: ecriture ? `Restitution enregistrée, caution soldée (écriture ${ecriture}).` : "Restitution enregistrée.",
    };
  });
}

export async function annulerContrat(contratId: string, motif: string): Promise<Resultat> {
  return operer("reservation.contrat.gerer", async (organizationId, userId) => {
    if (!UUID.test(contratId) || motif.trim().length < 3) {
      return { ok: false, message: "Indiquez le motif de l'annulation." };
    }
    const fait = await db.transaction((tx) => annulerContratDans(tx, organizationId, contratId, motif.trim(), userId));
    return fait
      ? { ok: true, message: "Réservation annulée." }
      : { ok: false, message: "Seule une réservation pas encore remise s'annule." };
  });
}

const schemaAdherent = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom de l'adhérent."),
  telephone: z.string().trim().max(30).optional(),
  formule: z.string().trim().min(2, "Indiquez la formule."),
  debut: z.string().regex(DATE_ISO),
  fin: z.string().regex(DATE_ISO),
  montant: z.coerce.number().int().min(0),
  seancesIncluses: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().positive().nullable()),
  moyen: MOYEN,
});

export async function inscrireAdherent(donnees: FormData): Promise<Resultat> {
  return operer("reservation.abonnement.gerer", async (organizationId, userId) => {
    const analyse = schemaAdherent.safeParse({
      nom: donnees.get("nom"),
      telephone: String(donnees.get("telephone") ?? "") || undefined,
      formule: donnees.get("formule"),
      debut: donnees.get("debut"),
      fin: donnees.get("fin"),
      montant: String(donnees.get("montant") ?? "0").replace(/[\s  ]/g, ""),
      seancesIncluses: String(donnees.get("seancesIncluses") ?? ""),
      moyen: donnees.get("moyen") ?? "especes",
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };

    const { code } = await db.transaction((tx) => inscrireAdherentDans(tx, organizationId, analyse.data, userId));
    return { ok: true, message: `Adhérent ${code} inscrit, formule encaissée.` };
  });
}

export async function enregistrerPassage(abonnementId: string): Promise<Resultat> {
  return operer("reservation.abonnement.gerer", async (organizationId, userId) => {
    if (!UUID.test(abonnementId)) return { ok: false, message: "Adhérent introuvable." };
    const { restantes } = await db.transaction((tx) =>
      enregistrerPassageDans(tx, organizationId, abonnementId, userId),
    );
    await tracer({ action: "abonnement.passage", entite: "abonnement", entiteId: abonnementId, apres: { restantes } });
    return {
      ok: true,
      message:
        restantes === null
          ? "Entrée enregistrée."
          : `Entrée enregistrée — ${restantes} séance${restantes > 1 ? "s" : ""} restante${restantes > 1 ? "s" : ""}.`,
    };
  });
}
