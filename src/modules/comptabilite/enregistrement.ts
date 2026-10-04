import "server-only";

import { auditLogs } from "@/db/schema";
import {
  estEquilibree,
  totalDebit,
  type Ecriture,
} from "@/lib/comptabilite/ecritures";
import { newId } from "@/lib/ids";
import { prochainNumero, type Transaction } from "@/lib/sequences";
import { ecritures, lignesEcriture } from "./schema";

export type OrigineEcriture =
  | "facture"
  | "avoir"
  | "reglement"
  | "achat"
  | "bon_caisse"
  | "vente_pos"
  | "bon_paiement"
  | "saisie"
  | "virement"
  | "avance"
  | "arrete_caisse"
  | "releve";

export interface ContexteEcriture {
  organizationId: string;
  userId: string;
  origine: OrigineEcriture;
  /** Identifiant technique de la pièce. Nul quand elle n'en a pas encore. */
  pieceId: string | null;
  exercice: string;
  dateIso: string;
}

/**
 * Pose une écriture DANS la transaction en cours.
 *
 * La transaction est un paramètre et non une ouverture locale : une vente de
 * caisse doit poser son ticket, sortir son stock et passer son écriture dans un
 * seul bloc. Deux transactions séparées laisseraient, en cas de coupure entre
 * les deux, une vente sans comptabilité ou une comptabilité sans vente — l'un
 * comme l'autre se découvrent à la clôture, quand plus personne ne sait d'où
 * vient l'écart.
 *
 * L'équilibre est revérifié ici alors que le moteur l'a déjà fait. Entre le
 * calcul et l'enregistrement, l'écriture a pu traverser une frontière réseau :
 * une balance fausse ne se répare pas, elle se traîne.
 */
export async function enregistrerEcritureDans(
  tx: Transaction,
  ecriture: Ecriture,
  contexte: ContexteEcriture,
): Promise<string> {
  if (!estEquilibree(ecriture)) {
    throw new Error("Écriture déséquilibrée : enregistrement refusé.");
  }

  const numero = await prochainNumero(tx, contexte.organizationId, {
    cle: `ecriture:${ecriture.journal}`,
    prefix: `${ecriture.journal}-${contexte.exercice}-`,
    padding: 5,
    periode: contexte.exercice,
  });

  const ecritureId = newId();

  await tx.insert(ecritures).values({
    id: ecritureId,
    organizationId: contexte.organizationId,
    journal: ecriture.journal,
    numero,
    exercice: contexte.exercice,
    dateEcriture: contexte.dateIso,
    libelle: ecriture.libelle,
    origine: contexte.origine,
    pieceId: contexte.pieceId,
    pieceNumero: ecriture.piece,
    passeeParUserId: contexte.userId,
  });

  await tx.insert(lignesEcriture).values(
    ecriture.lignes.map((ligne, index) => ({
      id: newId(),
      ecritureId,
      organizationId: contexte.organizationId,
      compte: ligne.compte,
      libelleCompte: ligne.libelleCompte,
      auxiliaire: ligne.auxiliaire ?? null,
      debit: ligne.debit,
      credit: ligne.credit,
      ordre: index,
    })),
  );

  await tx.insert(auditLogs).values({
    id: newId(),
    organizationId: contexte.organizationId,
    userId: contexte.userId,
    action: "ecriture.passer",
    entityType: "ecriture",
    entityId: ecritureId,
    after: {
      numero,
      journal: ecriture.journal,
      piece: ecriture.piece,
      montant: totalDebit(ecriture),
    },
  });

  return numero;
}
