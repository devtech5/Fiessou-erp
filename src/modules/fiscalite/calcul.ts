import type { CodeJournal, Ecriture, LigneEcriture } from "@/lib/comptabilite/ecritures";

/**
 * Fiscalité : déclaration de TVA et clôture d'exercice. Règles pures.
 *
 * La TVA du mois se lit dans les écritures : collectée au crédit des 443,
 * déductible au débit des 445. Rien n'est ressaisi — un montant recopié d'un
 * écran à un formulaire est un montant qui peut différer.
 */

export interface SoldeTva {
  compte: string;
  libelle: string;
  /** Débit moins crédit sur le mois. */
  solde: number;
}

export interface LiquidationTva {
  collectee: number;
  deductible: number;
  creditAnterieur: number;
  /** TVA à reverser au Trésor ce mois-ci. */
  aPayer: number;
  /** Crédit de TVA reporté sur le mois suivant. */
  creditReporte: number;
}

/**
 * TVA due du mois : collectée moins déductible moins le crédit reporté du mois
 * précédent. Négative, elle devient un crédit qu'on reporte — elle ne se
 * rembourse pas d'elle-même.
 */
export function liquiderTva(soldes: readonly SoldeTva[], creditAnterieur: number): LiquidationTva {
  if (!Number.isInteger(creditAnterieur) || creditAnterieur < 0) throw new Error("Crédit antérieur invalide.");
  const collectee = soldes.filter((s) => s.compte.startsWith("443")).reduce((t, s) => t - s.solde, 0);
  const deductible = soldes.filter((s) => s.compte.startsWith("445")).reduce((t, s) => t + s.solde, 0);
  const net = collectee - deductible - creditAnterieur;
  return { collectee, deductible, creditAnterieur, aPayer: Math.max(0, net), creditReporte: Math.max(0, -net) };
}

export const COMPTE_TVA_DUE = { numero: "4441", libelle: "État, TVA due" } as const;
export const COMPTE_CREDIT_TVA = { numero: "4449", libelle: "État, crédit de TVA à reporter" } as const;

const ligne = (compte: string, libelleCompte: string, debit: number, credit: number): LigneEcriture => ({ compte, libelleCompte, debit, credit });

/**
 * Écriture de liquidation : les comptes de TVA du mois sont soldés, la
 * différence passe en TVA due (4441) ou en crédit à reporter (4449).
 */
export function ecritureLiquidationTva(p: { mois: string; date: string; soldes: readonly SoldeTva[]; liquidation: LiquidationTva }): Ecriture | null {
  const l = p.liquidation;
  const lignes: LigneEcriture[] = [];
  for (const s of p.soldes) {
    if (s.solde === 0) continue;
    // On retourne chaque solde : un crédit de 443 se débite, un débit de 445 se crédite.
    lignes.push(ligne(s.compte, s.libelle, s.solde < 0 ? -s.solde : 0, s.solde > 0 ? s.solde : 0));
  }
  if (l.creditAnterieur > 0) lignes.push(ligne(COMPTE_CREDIT_TVA.numero, COMPTE_CREDIT_TVA.libelle, 0, l.creditAnterieur));
  if (l.aPayer > 0) lignes.push(ligne(COMPTE_TVA_DUE.numero, COMPTE_TVA_DUE.libelle, 0, l.aPayer));
  if (l.creditReporte > 0) lignes.push(ligne(COMPTE_CREDIT_TVA.numero, COMPTE_CREDIT_TVA.libelle, l.creditReporte, 0));
  if (lignes.length === 0) return null;
  const debit = lignes.reduce((t, x) => t + x.debit, 0);
  const credit = lignes.reduce((t, x) => t + x.credit, 0);
  if (debit !== credit) throw new Error(`Liquidation de TVA déséquilibrée : ${debit} contre ${credit}.`);
  return { journal: "OD", date: p.date, piece: `TVA-${p.mois}`, libelle: `Liquidation de la TVA de ${p.mois}`, lignes };
}

/** Paiement de la TVA due : 4441 au débit, trésorerie au crédit. */
export function ecriturePaiementTva(p: { mois: string; date: string; montant: number; tresorerie: { numero: string; libelle: string; journal: CodeJournal } }): Ecriture {
  if (!Number.isInteger(p.montant) || p.montant <= 0) throw new Error("Rien à payer.");
  return {
    journal: p.tresorerie.journal,
    date: p.date,
    piece: `TVA-${p.mois}-P`,
    libelle: `Paiement de la TVA de ${p.mois}`,
    lignes: [ligne(COMPTE_TVA_DUE.numero, COMPTE_TVA_DUE.libelle, p.montant, 0), ligne(p.tresorerie.numero, p.tresorerie.libelle, 0, p.montant)],
  };
}

/** Échéance indicative de la déclaration : le 15 du mois suivant. À confirmer selon le régime. */
export function echeanceTva(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a, m, 15)).toISOString().slice(0, 10);
}

export function finDeMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- clôture

export interface SoldeGestion {
  compte: string;
  libelle: string;
  /** Débit moins crédit sur l'exercice. */
  solde: number;
}

/**
 * Résultat de l'exercice : produits (classe 7) moins charges (classe 6), plus
 * les comptes hors activités ordinaires (classe 8) dans leur sens.
 */
export function resultatExercice(soldes: readonly SoldeGestion[]): number {
  return -soldes.filter((s) => /^[678]/.test(s.compte)).reduce((t, s) => t + s.solde, 0);
}

export const COMPTE_BENEFICE = { numero: "131", libelle: "Résultat net : bénéfice" } as const;
export const COMPTE_PERTE = { numero: "139", libelle: "Résultat net : perte" } as const;

/**
 * Écriture de détermination du résultat : chaque compte de gestion est soldé,
 * la différence va en 131 (bénéfice) ou 139 (perte). Datée du dernier jour de
 * l'exercice ; c'est elle qui met le résultat au bilan.
 */
export function ecritureCloture(p: { exercice: string; soldes: readonly SoldeGestion[] }): Ecriture {
  const gestion = p.soldes.filter((s) => /^[678]/.test(s.compte) && s.solde !== 0);
  if (gestion.length === 0) throw new Error("Aucun compte de charge ni de produit à solder sur cet exercice.");
  const lignes: LigneEcriture[] = gestion.map((s) => ligne(s.compte, s.libelle, s.solde < 0 ? -s.solde : 0, s.solde > 0 ? s.solde : 0));
  const resultat = resultatExercice(gestion);
  if (resultat > 0) lignes.push(ligne(COMPTE_BENEFICE.numero, COMPTE_BENEFICE.libelle, 0, resultat));
  if (resultat < 0) lignes.push(ligne(COMPTE_PERTE.numero, COMPTE_PERTE.libelle, -resultat, 0));
  const debit = lignes.reduce((t, x) => t + x.debit, 0);
  const credit = lignes.reduce((t, x) => t + x.credit, 0);
  if (debit !== credit) throw new Error("Écriture de clôture déséquilibrée.");
  return {
    journal: "OD",
    date: `${p.exercice}-12-31`,
    piece: `CLO-${p.exercice}`,
    libelle: `Détermination du résultat de l'exercice ${p.exercice} — ${resultat >= 0 ? "bénéfice" : "perte"}`,
    lignes,
  };
}

/** Un exercice se clôture une fois terminé : jamais l'année en cours. */
export function refusCloture(exercice: string, aujourdhui: string, dejaClos: boolean): string | null {
  if (!/^\d{4}$/.test(exercice)) return "Exercice invalide.";
  if (dejaClos) return `L'exercice ${exercice} est déjà clôturé.`;
  if (`${exercice}-12-31` >= aujourdhui) return `L'exercice ${exercice} n'est pas terminé : il se clôture à partir du 1er janvier ${Number(exercice) + 1}.`;
  return null;
}
