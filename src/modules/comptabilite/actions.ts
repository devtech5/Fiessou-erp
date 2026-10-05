"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { messageRefus, peut } from "@/lib/droits/garde";
import { ecritureSaisieGuidee, TVA_TAUX_NORMAL } from "@/lib/comptabilite/ecritures";
import { prochainNumero } from "@/lib/sequences";
import { enregistrerEcritureDans, PeriodeVerrouillee } from "./enregistrement";
import { estDoublon } from "@/lib/erreurs-pg";

// ------------------------------------------------------------ saisie guidée

export interface EtatSaisie {
  erreur?: string;
  /** Numéro de l'écriture passée — sert à confirmer sans recharger la page. */
  numero?: string;
}

const schemaSaisie = z.object({
  journal: z.enum(["VE", "AC", "CA", "BQ"]),
  compte: z.string().trim().regex(/^[1-8]\d{1,4}$/, "Numéro de compte invalide."),
  libelleCompte: z.string().trim().min(2),
  sens: z.enum(["charge", "produit"]),
  libelle: z.string().trim().min(3, "Décrivez l'opération en quelques mots."),
  date: z.iso.date("Date invalide."),
  piece: z.string().trim().max(40).optional(),
  avecTva: z.boolean(),
  montant: z
    .string()
    .trim()
    // Les espaces d'un « 1 500 000 » recopié depuis un tableur sont retirés
    // avant conversion. Les décimales, elles, restent refusées : il n'existe
    // pas de demi-franc.
    .transform((valeur) => Number(valeur.replace(/[\s ]/g, "")))
    .pipe(z.number().int().min(1, "Indiquez le montant de la pièce.")),
});

/**
 * Passe une écriture saisie à la main.
 *
 * L'exploitant ne désigne qu'un compte ; la contrepartie vient du journal et
 * l'écriture est CONSTRUITE ici, jamais transmise par le navigateur. Accepter
 * des lignes toutes faites laisserait n'importe qui poster l'écriture de son
 * choix — et une comptabilité ne se corrige pas, elle se contre-passe.
 *
 * C'est ce qui permet d'enregistrer ce que la caisse ne produit pas : un
 * loyer, une facture d'électricité, un achat réglé en espèces.
 */
export async function saisirEcriture(
  _precedent: EtatSaisie,
  donnees: FormData,
): Promise<EtatSaisie> {
  const session = await exigerEntreprise();

  if (!(await peut("comptabilite.ecriture.enregistrer"))) {
    return { erreur: messageRefus("comptabilite.ecriture.enregistrer") };
  }

  const analyse = schemaSaisie.safeParse({
    journal: donnees.get("journal"),
    compte: donnees.get("compte"),
    libelleCompte: donnees.get("libelleCompte"),
    sens: donnees.get("sens"),
    libelle: donnees.get("libelle"),
    date: donnees.get("date"),
    piece: String(donnees.get("piece") ?? "").trim() || undefined,
    avecTva: donnees.get("avecTva") === "on",
    montant: String(donnees.get("montant") ?? ""),
  });

  if (!analyse.success) return { erreur: analyse.error.issues[0].message };

  const saisie = analyse.data;
  const exercice = saisie.date.slice(0, 4);

  try {
    const numero = await db.transaction(async (tx) => {
      // Sans référence de pièce, l'écriture reçoit la sienne. L'unicité porte
      // sur le numéro de pièce : deux saisies sans référence se heurteraient
      // sinon dès la seconde.
      const piece =
        saisie.piece ??
        (await prochainNumero(tx, session.organizationId, {
          cle: "piece:saisie",
          prefix: `SA-${exercice}-`,
          padding: 5,
          periode: exercice,
        }));

      const ecriture = ecritureSaisieGuidee({
        journal: saisie.journal,
        date: saisie.date,
        piece,
        libelle: saisie.libelle,
        compte: saisie.compte,
        libelleCompte: saisie.libelleCompte,
        sens: saisie.sens,
        montant: saisie.montant,
        tauxTvaBp: saisie.avecTva ? TVA_TAUX_NORMAL * 100 : undefined,
      });

      return enregistrerEcritureDans(tx, ecriture, {
        organizationId: session.organizationId,
        userId: session.userId,
        origine: "saisie",
        pieceId: null,
        exercice,
        dateIso: saisie.date,
      });
    });

    revalidatePath("/comptabilite");
    revalidatePath("/comptabilite/ecritures");
    revalidatePath("/comptabilite/etats");

    return { numero };
  } catch (erreur) {
    // 23505 : violation d'unicité. Une pièce déjà comptabilisée.
    if (estDoublon(erreur)) {
      return { erreur: "Cette pièce a déjà été comptabilisée." };
    }
    if (erreur instanceof PeriodeVerrouillee) return { erreur: erreur.message };
    throw erreur;
  }
}
