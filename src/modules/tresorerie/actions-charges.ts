"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { refusDroit } from "@/lib/droits/garde";
import { estDoublon } from "@/lib/erreurs-pg";
import { notifierDetenteurs } from "@/modules/communication/notifications";
import { CATEGORIES_DEPENSE, type CategorieDepense } from "@/modules/projets/calcul";

import { familleConnue, libelleMois, PERIODICITES, type Periodicite } from "./charges";
import {
  basculerChargeDans,
  creerChargeDans,
  definirBudgetDans,
  ignorerEcheanceDans,
  preparerEcheanceDans,
  supprimerChargeDans,
} from "./creation-charges";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIODE = /^\d{4}-\d{2}$/;

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

type Contexte = { organizationId: string; userId: string };

/**
 * Toutes les actions de la page Charges relèvent d'un seul droit. Préparer une
 * dépense n'est pas l'approuver : elle part dans le circuit ordinaire.
 */
async function operer(travail: (ctx: Contexte) => Promise<Resultat>): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("tresorerie.charges.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  try {
    const r = await travail({ organizationId: session.organizationId, userId: session.userId });
    if (r.ok) {
      revalidatePath("/tresorerie", "layout");
      revalidatePath("/projets", "layout");
      revalidatePath("/");
    }
    return r;
  } catch (erreur) {
    if (estDoublon(erreur)) return { ok: false, message: "Cette échéance est déjà traitée." };
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 240;
    if (!lisible) console.error("Charges : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

const texte = (d: FormData, champ: string) => {
  const v = d.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};
/** Montant saisi : chiffres et espaces seulement, en francs entiers. */
const montant = (v: string | undefined) => {
  if (v === undefined) return undefined;
  const propre = v.replace(/[\s  ]/g, "");
  return /^\d+$/.test(propre) ? Number(propre) : Number.NaN;
};

const CATEGORIES = Object.keys(CATEGORIES_DEPENSE) as [CategorieDepense, ...CategorieDepense[]];
const PERIODICITES_CLES = Object.keys(PERIODICITES) as [Periodicite, ...Periodicite[]];

const schemaCharge = z.object({
  libelle: z.string({ error: "Donnez un libellé à la charge." }).trim().min(2, "Donnez un libellé à la charge.").max(120),
  categorie: z.enum(CATEGORIES, { error: "Choisissez la nature de la charge." }),
  montant: z.number({ error: "Indiquez le montant." }).int("Montant en francs entiers.").positive("Le montant doit être positif."),
  periodicite: z.enum(PERIODICITES_CLES, { error: "Choisissez la périodicité." }),
  premiereEcheance: z.string({ error: "Indiquez la première échéance." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez la première échéance."),
  fournisseurLibelle: z.string().trim().max(120).optional(),
});

export async function creerChargeRecurrente(donnees: FormData): Promise<Resultat> {
  return operer(async ({ organizationId, userId }) => {
    const analyse = schemaCharge.safeParse({
      libelle: texte(donnees, "libelle"),
      categorie: texte(donnees, "categorie"),
      montant: montant(texte(donnees, "montant")),
      periodicite: texte(donnees, "periodicite"),
      premiereEcheance: texte(donnees, "premiereEcheance"),
      fournisseurLibelle: texte(donnees, "fournisseurLibelle"),
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    const fournisseurId = texte(donnees, "fournisseurId");
    await db.transaction((tx) =>
      creerChargeDans(
        tx,
        organizationId,
        {
          ...analyse.data,
          tauxTva: donnees.get("avecTva") === "on" ? 1800 : 0,
          fournisseurId: fournisseurId && UUID.test(fournisseurId) ? fournisseurId : null,
        },
        userId,
      ),
    );
    return { ok: true, message: `« ${analyse.data.libelle} » ajoutée aux charges récurrentes.` };
  });
}

export async function basculerChargeRecurrente(chargeId: string, actif: boolean): Promise<Resultat> {
  return operer(async ({ organizationId, userId }) => {
    if (!UUID.test(chargeId)) return { ok: false, message: "Charge introuvable." };
    await db.transaction((tx) => basculerChargeDans(tx, organizationId, chargeId, actif, userId));
    return { ok: true, message: actif ? "Charge reprise." : "Charge suspendue : plus aucune échéance ne sera proposée." };
  });
}

export async function supprimerChargeRecurrente(chargeId: string): Promise<Resultat> {
  return operer(async ({ organizationId, userId }) => {
    if (!UUID.test(chargeId)) return { ok: false, message: "Charge introuvable." };
    await db.transaction((tx) => supprimerChargeDans(tx, organizationId, chargeId, userId));
    return { ok: true, message: "Charge retirée. Les dépenses déjà préparées restent." };
  });
}

/** Prépare la dépense d'une échéance et prévient ceux qui l'approuvent. */
export async function preparerEcheance(chargeId: string, periode: string): Promise<Resultat> {
  return operer(async ({ organizationId, userId }) => {
    if (!UUID.test(chargeId) || !PERIODE.test(periode)) return { ok: false, message: "Échéance introuvable." };
    const { numero } = await db.transaction((tx) => preparerEcheanceDans(tx, organizationId, chargeId, periode, userId));
    await notifierDetenteurs(
      organizationId,
      "depense.approuver",
      { categorie: "depense", titre: `Dépense ${numero} à approuver`, corps: `Échéance de ${libelleMois(periode)}`, lien: "/projets/depenses" },
      userId,
    );
    return { ok: true, message: `Dépense ${numero} préparée — elle attend son approbation.` };
  });
}

export async function ignorerEcheance(chargeId: string, periode: string): Promise<Resultat> {
  return operer(async ({ organizationId, userId }) => {
    if (!UUID.test(chargeId) || !PERIODE.test(periode)) return { ok: false, message: "Échéance introuvable." };
    await db.transaction((tx) => ignorerEcheanceDans(tx, organizationId, chargeId, periode, userId));
    return { ok: true, message: `Échéance de ${libelleMois(periode)} écartée.` };
  });
}

/** Fixe l'enveloppe mensuelle d'une famille ; un montant vide ou nul la retire. */
export async function definirBudget(famille: string, saisie: string): Promise<Resultat> {
  return operer(async ({ organizationId, userId }) => {
    if (!familleConnue(famille)) return { ok: false, message: "Famille de charges inconnue." };
    const valeur = saisie.trim() === "" ? 0 : montant(saisie);
    if (valeur === undefined || !Number.isInteger(valeur) || valeur < 0) return { ok: false, message: "Montant en francs entiers." };
    await db.transaction((tx) => definirBudgetDans(tx, organizationId, famille, valeur, userId));
    return { ok: true, message: valeur === 0 ? "Budget retiré." : "Budget enregistré." };
  });
}
