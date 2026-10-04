import "server-only";

import type { Transaction } from "@/lib/sequences";
import { commissionIndicative } from "@/modules/monnaie/calcul";
import {
  annulerOperationDans,
  cloturerSessionDans,
  enregistrerOperationDans,
  ouvrirSessionDans,
  type NouvelleOperation,
} from "@/modules/monnaie/creation";

/**
 * Amorçage du guichet de monnaie électronique.
 *
 * Une journée d'hier, clôturée avec un petit manquant, puis la session du
 * jour encore ouverte — float Moov presque vide, pour que l'alerte du tableau
 * de bord ait quelque chose de vrai à dire. Tout passe par les fonctions du
 * module : contrôle des deux réserves, numérotation, écriture de clôture.
 */

type Op = Omit<NouvelleOperation, "commission">;

const HIER: Op[] = [
  { type: "depot", reseau: "wave", montant: 50_000, telephone: "07 88 45 12 33" },
  { type: "retrait", reseau: "orange", montant: 25_000, telephone: "07 12 90 44 21" },
  { type: "credit", reseau: "mtn", montant: 1_000, telephone: "05 66 21 08 74" },
  { type: "depot", reseau: "orange", montant: 100_000, telephone: "01 44 78 90 12" },
  { type: "retrait", reseau: "wave", montant: 75_000, telephone: "07 33 21 65 09" },
  { type: "depot", reseau: "mtn", montant: 15_000, telephone: "05 90 12 34 56" },
  { type: "retrait", reseau: "moov", montant: 40_000, telephone: "01 77 88 99 00" },
  { type: "approvisionnement", reseau: "wave", montant: 200_000, referenceOperateur: "SA-ADJ-55120" },
];

const AUJOURDHUI: Op[] = [
  { type: "depot", reseau: "wave", montant: 200_000, telephone: "05 11 22 33 44", referenceOperateur: "WV.2610.8841" },
  { type: "retrait", reseau: "wave", montant: 30_000, telephone: "07 98 76 54 32" },
  { type: "credit", reseau: "orange", montant: 500, telephone: "07 55 44 33 22" },
  { type: "depot", reseau: "moov", montant: 120_000, telephone: "01 23 45 67 89" },
  { type: "retrait", reseau: "mtn", montant: 20_000, telephone: "05 44 33 22 11" },
];

export async function amorcerGuichet(
  tx: Transaction,
  organizationId: string,
  userId: string,
): Promise<{ sessions: number; operations: number }> {
  const hier = new Date(Date.now() - 24 * 3600 * 1000);
  hier.setUTCHours(7, 30, 0, 0);

  await ouvrirSessionDans(
    tx,
    organizationId,
    { fondCaisse: 250_000, floats: { wave: 1_000_000, orange: 500_000, mtn: 350_000, moov: 200_000 }, ouverteLe: hier },
    userId,
  );
  let soldes = null as Awaited<ReturnType<typeof enregistrerOperationDans>>["soldes"] | null;
  for (const op of HIER) {
    ({ soldes } = await enregistrerOperationDans(tx, organizationId, { ...op, commission: commissionIndicative(op.type, op.montant) }, userId));
  }

  // Un manquant de 500 F au comptage : il passera en 658, pas en compte d'attente.
  await cloturerSessionDans(
    tx,
    organizationId,
    {
      especesComptees: soldes!.especes - 500,
      releves: soldes!.floats,
      observations: "Pièce de 500 introuvable au comptage.",
    },
    userId,
  );

  await ouvrirSessionDans(tx, organizationId, { fondCaisse: soldes!.especes - 500, floats: soldes!.floats }, userId);
  let saisieErronee: string | null = null;
  for (const op of AUJOURDHUI) {
    const { id } = await enregistrerOperationDans(
      tx,
      organizationId,
      { ...op, commission: commissionIndicative(op.type, op.montant) },
      userId,
    );
    saisieErronee ??= op.type === "credit" ? id : null;
  }
  // Une vente de crédit saisie sur le mauvais réseau, annulée avec son motif.
  if (saisieErronee) await annulerOperationDans(tx, organizationId, saisieErronee, "Saisi sur Orange au lieu de MTN", userId);

  return { sessions: 2, operations: HIER.length + AUJOURDHUI.length };
}
