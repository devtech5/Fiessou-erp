import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { documentSequences } from "@/db/schema";
import { buildDocumentNumber, newId } from "@/lib/ids";

/**
 * Transaction Drizzle. Nommée ici parce que trois modules la réécrivaient.
 */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface FormatSequence {
  /** Nature du compteur : `ecriture:VE`, `tiers`, `article`, `auxiliaire:411`… */
  cle: string;
  prefix?: string;
  suffix?: string;
  padding?: number;
  /** Période de remise à zéro : « 2026 », « 2026-08 », ou vide pour un compteur continu. */
  periode?: string;
  /** Caisse, dépôt ou agence propriétaire du compteur. Vide = toute l'entreprise. */
  scope?: string;
}

/**
 * Attribue le prochain numéro d'un compteur, dans la transaction en cours.
 *
 * L'incrément et la lecture se font en une seule requête, avec RETURNING : un
 * SELECT suivi d'un UPDATE laisserait deux appels concurrents repartir du même
 * numéro, et une numérotation de pièce ne tolère ni trou ni doublon. La ligne
 * de compteur est verrouillée le temps de l'opération, ce qui sérialise
 * naturellement les demandes sur la même clé.
 *
 * Appeler dans la MÊME transaction que la création de la pièce. Un numéro
 * attribué dans une transaction qui échoue ensuite laisse un trou dans la
 * suite — exactement ce que la séquence est censée empêcher.
 */
export async function prochainNumero(
  tx: Transaction,
  organizationId: string,
  format: FormatSequence,
): Promise<string> {
  const {
    cle,
    prefix = "",
    suffix = "",
    padding = 6,
    periode = "",
    scope = "",
  } = format;

  const existants = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(
      and(
        eq(documentSequences.organizationId, organizationId),
        eq(documentSequences.key, cle),
        eq(documentSequences.scope, scope),
        eq(documentSequences.periodKey, periode),
      ),
    )
    .returning({ valeur: documentSequences.nextValue });

  if (existants.length > 0) {
    return buildDocumentNumber({
      prefix,
      suffix,
      padding,
      // `next_value` porte déjà la valeur suivante : le numéro attribué est
      // celui d'avant l'incrément.
      value: existants[0].valeur - 1,
    });
  }

  // Premier numéro de ce compteur pour cette période.
  await tx.insert(documentSequences).values({
    id: newId(),
    organizationId,
    key: cle,
    scope,
    prefix,
    suffix,
    padding,
    periodicity: periode ? "annuelle" : "aucune",
    periodKey: periode,
    nextValue: 2,
  });

  return buildDocumentNumber({ prefix, suffix, padding, value: 1 });
}

/**
 * Prochain numéro que personne ne porte encore.
 *
 * Pour les RÉFÉRENCES (matricule, code d'actif, code d'intervenant), pas pour
 * les pièces : une référence peut être imposée — reprise d'un fichier, jeu de
 * démonstration — sans faire avancer le compteur, et la création suivante
 * recevait alors un numéro déjà pris. Un numéro sauté n'a pas à se justifier
 * pour une référence ; un doublon, si. Une facture ou un ticket, eux, ne
 * passent jamais par ici : leur suite ne tolère pas de trou.
 */
export async function prochainNumeroLibre(
  tx: Transaction,
  organizationId: string,
  format: FormatSequence,
  estPris: (candidat: string) => Promise<boolean>,
): Promise<string> {
  for (let essai = 0; essai < 500; essai++) {
    const candidat = await prochainNumero(tx, organizationId, format);
    if (!(await estPris(candidat))) return candidat;
  }
  throw new Error("Aucune référence libre : saisissez-la à la main.");
}
