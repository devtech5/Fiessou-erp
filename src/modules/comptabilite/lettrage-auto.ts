import "server-only";

import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";

import { documentSequences } from "@/db/schema";
import { verifierLettrage, versLettres } from "@/lib/comptabilite/lettrage";
import { newId } from "@/lib/ids";
import type { Transaction } from "@/lib/sequences";

import { ecritures, lignesEcriture } from "./schema";

/**
 * Prochain code de lettrage de l'entreprise : A, B, … Z, AA.
 *
 * Incrémenté dans la transaction, comme la numérotation des écritures : deux
 * lettrages simultanés qui obtiendraient le même code rapprocheraient des
 * lignes sans rapport entre elles.
 */
export async function prochainCodeLettrage(tx: Transaction, organizationId: string): Promise<string> {
  const cle = "lettrage";
  const existants = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(and(eq(documentSequences.organizationId, organizationId), eq(documentSequences.key, cle)))
    .returning({ valeur: documentSequences.nextValue });
  if (existants.length > 0) return versLettres(existants[0].valeur - 1);

  await tx.insert(documentSequences).values({
    id: newId(),
    organizationId,
    key: cle,
    scope: "",
    periodicity: "aucune",
    periodKey: "",
    nextValue: 2,
  });
  return versLettres(1);
}

/**
 * Lettre automatiquement le compte client (ou fournisseur) d'un ensemble de
 * pièces soldées.
 *
 * Une facture annulée par son avoir, ou entièrement réglée, n'a plus rien
 * d'ouvert : ses lignes au 411 se rapprochent d'elles-mêmes. Sans cela, la
 * fiche client affichait « Ouvert » sur des mouvements qui se compensent, et
 * le comptable devait lettrer à la main ce que le logiciel savait déjà.
 *
 * Ne lettre que si les lignes non lettrées s'équilibrent exactement : un
 * règlement partiel reste ouvert, et c'est voulu.
 */
export async function lettrerPiecesSoldees(
  tx: Transaction,
  organizationId: string,
  pieceIds: string[],
  compteAuxiliaire: string,
  /** Compte collectif : 411 pour un client, 401 pour un fournisseur. */
  collectif: "411" | "401" = "411",
): Promise<string | null> {
  if (pieceIds.length === 0) return null;
  const lignes = await tx
    .select({
      id: lignesEcriture.id,
      compte: lignesEcriture.compte,
      auxiliaire: lignesEcriture.auxiliaire,
      debit: lignesEcriture.debit,
      credit: lignesEcriture.credit,
      lettrage: lignesEcriture.lettrage,
    })
    .from(lignesEcriture)
    .innerJoin(ecritures, eq(ecritures.id, lignesEcriture.ecritureId))
    .where(
      and(
        eq(lignesEcriture.organizationId, organizationId),
        inArray(ecritures.pieceId, pieceIds),
        like(lignesEcriture.compte, `${collectif}%`),
        eq(lignesEcriture.auxiliaire, compteAuxiliaire),
        isNull(lignesEcriture.lettrage),
      ),
    );
  if (lignes.length < 2 || !verifierLettrage(lignes).ok) return null;

  const code = await prochainCodeLettrage(tx, organizationId);
  await tx
    .update(lignesEcriture)
    .set({ lettrage: code, updatedAt: new Date() })
    .where(inArray(lignesEcriture.id, lignes.map((l) => l.id)));
  return code;
}
