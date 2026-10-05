import type { Ecriture, CodeJournal } from "@/lib/comptabilite/ecritures";
import { rateOf } from "@/lib/money";

import type { PalierCommission } from "./schema";

/**
 * Commissions des commerciaux. Règles pures.
 *
 * Une commission = une part FIXE mensuelle + une part VARIABLE, calculée sur
 * le chiffre d'affaires HT ou sur la marge. La part variable suit un taux
 * unique, ou des paliers progressifs : « 3 % jusqu'à 2 millions, 5 % au-delà »
 * — chaque taux ne s'applique qu'à la tranche qui lui revient, comme un
 * barème d'impôt. Un vendeur qui franchit un palier n'y perd jamais.
 */

export interface RegleCommission {
  base: "ca_ht" | "marge";
  tauxBp: number;
  paliers: PalierCommission[] | null;
  fixeMensuel: number;
}

export interface Realisation {
  /** CA HT net des avoirs. */
  caHt: number;
  /** CA HT moins le coût des marchandises sorties. */
  marge: number;
}

export interface CalculCommission {
  assiette: number;
  variable: number;
  fixe: number;
  total: number;
}

export function refusRegle(r: RegleCommission): string | null {
  if (!Number.isInteger(r.tauxBp) || r.tauxBp < 0 || r.tauxBp > 10_000) return "Taux entre 0 et 100 %.";
  if (!Number.isInteger(r.fixeMensuel) || r.fixeMensuel < 0) return "Part fixe en francs entiers, positive.";
  if (r.paliers?.length) {
    if (r.paliers.length > 10) return "Dix paliers au plus.";
    const tries = [...r.paliers].sort((a, b) => a.seuil - b.seuil);
    if (tries[0].seuil !== 0) return "Le premier palier part de 0 F.";
    for (let i = 0; i < tries.length; i++) {
      const p = tries[i];
      if (!Number.isInteger(p.seuil) || p.seuil < 0) return "Seuils en francs entiers, positifs.";
      if (!Number.isInteger(p.tauxBp) || p.tauxBp < 0 || p.tauxBp > 10_000) return "Taux de palier entre 0 et 100 %.";
      if (i > 0 && p.seuil === tries[i - 1].seuil) return `Deux paliers partent de ${p.seuil} F.`;
    }
  }
  return null;
}

/** Part variable, tranche par tranche. Une assiette négative ne commissionne rien. */
export function partVariable(assiette: number, r: Pick<RegleCommission, "tauxBp" | "paliers">): number {
  if (assiette <= 0) return 0;
  if (!r.paliers?.length) return rateOf(assiette, r.tauxBp);
  const tries = [...r.paliers].sort((a, b) => a.seuil - b.seuil);
  let total = 0;
  for (let i = 0; i < tries.length; i++) {
    const bas = tries[i].seuil;
    const haut = tries[i + 1]?.seuil ?? Infinity;
    if (assiette <= bas) break;
    total += rateOf(Math.min(assiette, haut) - bas, tries[i].tauxBp);
  }
  return total;
}

export function calculerCommission(realisation: Realisation, r: RegleCommission): CalculCommission {
  const assiette = r.base === "marge" ? realisation.marge : realisation.caHt;
  const variable = partVariable(assiette, r);
  return { assiette, variable, fixe: r.fixeMensuel, total: variable + r.fixeMensuel };
}

/** Avancement vers l'objectif, en points de base ; nul sans objectif. */
export function atteinteObjectif(caHt: number, objectif: number): number | null {
  if (objectif <= 0) return null;
  return Math.max(0, Math.round((caHt * 10_000) / objectif));
}

export const COMPTE_COMMISSIONS = { numero: "6322", libelle: "Commissions et courtages sur ventes" } as const;

/** Paiement d'une commission à un commercial externe : charge au débit, trésorerie au crédit. */
export function ecriturePaiementCommission(p: {
  piece: string;
  date: string;
  commercial: string;
  mois: string;
  montant: number;
  tresorerie: { numero: string; libelle: string; journal: CodeJournal };
}): Ecriture {
  if (!Number.isInteger(p.montant) || p.montant <= 0) throw new Error("Rien à payer.");
  return {
    journal: p.tresorerie.journal,
    date: p.date,
    piece: p.piece,
    libelle: `Commission ${p.mois} — ${p.commercial}`,
    lignes: [
      { compte: COMPTE_COMMISSIONS.numero, libelleCompte: COMPTE_COMMISSIONS.libelle, debit: p.montant, credit: 0 },
      { compte: p.tresorerie.numero, libelleCompte: p.tresorerie.libelle, debit: 0, credit: p.montant },
    ],
  };
}

/** Bornes d'un mois, pour filtrer les ventes : [premier jour, premier jour du mois suivant[. */
export function bornesMois(mois: string): { du: string; au: string } {
  const [a, m] = mois.split("-").map(Number);
  const suivant = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return { du: `${mois}-01`, au: `${suivant}-01` };
}
