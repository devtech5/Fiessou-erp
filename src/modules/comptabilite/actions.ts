"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { ecritureAvoir, ecritureFacture } from "@/lib/comptabilite/ecritures";
import { DOCUMENTS, comptabilisable } from "@/lib/fixtures/gestion";
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

  const lignes = await db
    .select({ pieceNumero: ecritures.pieceNumero, numero: ecritures.numero })
    .from(ecritures)
    .where(eq(ecritures.organizationId, session.organizationId));

  return Object.fromEntries(lignes.map((l) => [l.pieceNumero, l.numero]));
}
