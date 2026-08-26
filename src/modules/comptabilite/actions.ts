"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { messageRefus, peut } from "@/lib/droits/garde";
import {
  ecritureAvoir,
  ecritureFacture,
  ecritureSaisieGuidee,
  TVA_TAUX_NORMAL,
} from "@/lib/comptabilite/ecritures";
import { DOCUMENTS, comptabilisable } from "@/lib/fixtures/gestion";
import { prochainNumero } from "@/lib/sequences";
import { enregistrerEcritureDans, type ContexteEcriture } from "./enregistrement";
import { ecritures } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultatComptabilisation =
  | { ok: true; numero: string }
  | { ok: false; message: string };

/** Convertit « 23/08/2026 » en date ISO. */
function versIso(date: string): string {
  const [jour, mois, annee] = date.split("/");
  return `${annee}-${mois}-${jour}`;
}

/**
 * Comptabilise une pièce commerciale.
 *
 * L'écriture n'est pas transmise par le client : elle est RECALCULÉE côté
 * serveur depuis la pièce. Accepter des lignes toutes faites laisserait
 * n'importe qui poster l'écriture de son choix.
 */
export async function comptabiliserPiece(
  documentId: string,
): Promise<ResultatComptabilisation> {
  const session = await exigerEntreprise();

  if (!(await peut("comptabilite.ecriture.enregistrer"))) {
    return { ok: false, message: messageRefus("comptabilite.ecriture.enregistrer") };
  }

  const document = DOCUMENTS.find((d) => d.id === documentId);
  if (!document) return { ok: false, message: "Pièce introuvable." };

  if (!comptabilisable(document)) {
    return {
      ok: false,
      message:
        document.nature === "devis"
          ? "Un devis ne se comptabilise pas tant qu'il n'est pas accepté."
          : "Une pièce en brouillon ou refusée ne se comptabilise pas.",
    };
  }

  const piece = {
    numero: document.numero,
    date: document.date,
    client: document.client,
    compteAuxiliaire: document.compteAuxiliaire,
    lignes: document.lignes,
  };

  try {
    const ecriture =
      document.nature === "avoir" ? ecritureAvoir(piece) : ecritureFacture(piece);

    const contexte: ContexteEcriture = {
      organizationId: session.organizationId,
      userId: session.userId,
      origine: document.nature === "avoir" ? "avoir" : "facture",
      // Les fixtures utilisent des identifiants courts ; la colonne attend
      // un UUID. Le numéro de pièce suffit à la traçabilité et porte
      // l'unicité.
      pieceId: UUID.test(documentId) ? documentId : null,
      exercice: document.date.slice(-4),
      dateIso: versIso(document.date),
    };

    const numero = await db.transaction((tx) =>
      enregistrerEcritureDans(tx, ecriture, contexte),
    );

    revalidatePath("/commercial/ventes");
    revalidatePath("/comptabilite");
    return { ok: true, numero };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);

    // La contrainte d'unicité fait son travail : la pièce était déjà passée.
    if (message.includes("ecritures_piece_unique")) {
      return { ok: false, message: "Cette pièce est déjà comptabilisée." };
    }

    if (message.includes("Écriture déséquilibrée")) {
      return { ok: false, message };
    }

    /**
     * Toute autre erreur reste au serveur.
     *
     * Un message de base de données contient les noms de colonnes, les
     * identifiants et parfois les valeurs insérées. Le renvoyer au navigateur
     * livre la structure interne à qui la lit — et n'apprend rien d'utile à
     * l'utilisateur, qui ne peut rien en faire.
     */
    console.error("Échec de comptabilisation", erreur);
    return {
      ok: false,
      message: "L'écriture n'a pas pu être enregistrée. Réessayez.",
    };
  }
}

/**
 * Écritures déjà passées, indexées par NUMÉRO de pièce.
 *
 * Par le numéro et non l'identifiant technique : c'est lui qui porte l'unicité
 * en base, et il reste lisible même quand la pièce n'a pas encore d'identifiant.
 */
export async function piecesComptabilisees(): Promise<Record<string, string>> {
  const session = await exigerEntreprise();
  if (!(await peut("comptabilite.ecriture.consulter"))) return {};

  const lignes = await db
    .select({ pieceNumero: ecritures.pieceNumero, numero: ecritures.numero })
    .from(ecritures)
    .where(eq(ecritures.organizationId, session.organizationId));

  return Object.fromEntries(lignes.map((l) => [l.pieceNumero, l.numero]));
}

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
    if (erreur instanceof Error && "code" in erreur && erreur.code === "23505") {
      return { erreur: "Cette pièce a déjà été comptabilisée." };
    }
    throw erreur;
  }
}
