import {
  COMPTES,
  decomposerTTC,
  estEquilibree,
  type Ecriture,
  type LigneEcriture,
} from "@/lib/comptabilite/ecritures";

import type { MoyenDepense, StatutDepense, StatutProjet } from "./schema";

/**
 * Règles des dépenses : nature et compte de charge, circuit d'approbation,
 * consommation du budget, écriture de paiement.
 */

export const LIBELLE_STATUT_PROJET: Record<StatutProjet, string> = {
  preparation: "En préparation",
  en_cours: "En cours",
  suspendu: "Suspendu",
  termine: "Terminé",
  annule: "Annulé",
};

/** Nature d'une dépense et son compte de charge SYSCOHADA. */
export const CATEGORIES_DEPENSE = {
  materiaux: { libelle: "Matériaux et fournitures", compte: "604", libelleCompte: "Achats stockés de matières et fournitures" },
  petit_materiel: { libelle: "Petit matériel, consommables", compte: "605", libelleCompte: "Autres achats" },
  transport: { libelle: "Transport, carburant", compte: "618", libelleCompte: "Autres frais de transport" },
  location: { libelle: "Location de matériel ou de local", compte: "622", libelleCompte: "Locations et charges locatives" },
  entretien: { libelle: "Entretien, réparation", compte: "624", libelleCompte: "Entretien, réparations et maintenance" },
  honoraires: { libelle: "Honoraires, prestataires", compte: "632", libelleCompte: "Rémunérations d'intermédiaires et de conseils" },
  main_oeuvre: { libelle: "Main-d'œuvre occasionnelle", compte: "637", libelleCompte: "Rémunérations de personnel extérieur" },
  // Les charges qui reviennent chaque mois ou chaque année : facture CIE,
  // SODECI, abonnement internet, assurance, patente.
  electricite: { libelle: "Électricité", compte: "6052", libelleCompte: "Fournitures non stockables — électricité" },
  eau: { libelle: "Eau", compte: "6051", libelleCompte: "Fournitures non stockables — eau" },
  telecom: { libelle: "Téléphone, internet", compte: "628", libelleCompte: "Frais de télécommunications" },
  assurance: { libelle: "Assurance", compte: "625", libelleCompte: "Primes d'assurance" },
  impots: { libelle: "Impôts et taxes (patente…)", compte: "641", libelleCompte: "Impôts et taxes directs" },
  divers: { libelle: "Autres dépenses", compte: "638", libelleCompte: "Autres charges externes" },
} as const;

export type CategorieDepense = keyof typeof CATEGORIES_DEPENSE;

export function categorieConnue(cle: string): cle is CategorieDepense {
  return cle in CATEGORIES_DEPENSE;
}

/**
 * Transitions du circuit.
 *
 *   demandée  → approuvée, rejetée, annulée
 *   approuvée → payée, annulée
 *   payée, rejetée, annulée : définitives
 *
 * Une dépense payée ne s'annule pas ici : l'argent est sorti. Elle se corrige
 * par une écriture, avec sa pièce.
 */
const SUIVANTS: Record<StatutDepense, StatutDepense[]> = {
  demandee: ["approuvee", "rejetee", "annulee"],
  approuvee: ["payee", "annulee"],
  payee: [],
  rejetee: [],
  annulee: [],
};

export function transitionDepense(de: StatutDepense, vers: StatutDepense): boolean {
  return SUIVANTS[de].includes(vers);
}

/**
 * Qui peut approuver ? Pas celui qui a demandé — sinon le circuit ne contrôle
 * rien. Seul le propriétaire, qui répond de tout, approuve ses propres
 * demandes : sans cela, un patron seul dans son entreprise serait bloqué.
 */
export function refusApprobation(demandeurId: string | null, approbateurId: string, estProprietaire: boolean): string | null {
  if (demandeurId === approbateurId && !estProprietaire) {
    return "Vous ne pouvez pas approuver votre propre demande : un autre responsable doit le faire.";
  }
  return null;
}

/** Ce qu'une dépense engage sur le budget : approuvée ou payée. Demandée, elle n'est qu'une intention. */
export function engageBudget(statut: StatutDepense): boolean {
  return statut === "approuvee" || statut === "payee";
}

export interface SuiviBudget {
  engage: number;
  paye: number;
  enAttente: number;
  /** Reste sur l'enveloppe ; nul sans budget fixé. */
  reste: number | null;
  /** Taux de consommation arrondi, ou nul sans budget. */
  taux: number | null;
}

export function suiviBudget(budget: number | null, depenses: readonly { statut: StatutDepense; montant: number }[]): SuiviBudget {
  let engage = 0;
  let paye = 0;
  let enAttente = 0;
  for (const d of depenses) {
    if (engageBudget(d.statut)) engage += d.montant;
    if (d.statut === "payee") paye += d.montant;
    if (d.statut === "demandee") enAttente += d.montant;
  }
  return {
    engage,
    paye,
    enAttente,
    reste: budget === null ? null : budget - engage,
    taux: budget === null || budget === 0 ? null : Math.round((engage * 100) / budget),
  };
}

/** Une approbation qui ferait dépasser l'enveloppe doit se voir avant de se faire. */
export function depasseBudget(budget: number | null, engage: number, montant: number): boolean {
  return budget !== null && engage + montant > budget;
}

// --------------------------------------------------------------- écriture

const TRESORERIE: Record<MoyenDepense, { numero: string; libelle: string }> = {
  especes: COMPTES.caisse,
  mobile_money: COMPTES.caisseMobileMoney,
  banque: COMPTES.banque,
};

/**
 * Paiement d'une dépense.
 *
 *   6xx  Charge selon la nature     débit   HT
 *   4451 TVA récupérable            débit   TVA (si facture normalisée)
 *   5xx  Trésorerie                 crédit  TTC
 */
export function ecritureDepense(depense: {
  numero: string;
  date: string;
  objet: string;
  categorie: CategorieDepense;
  montant: number;
  tauxTvaBp: number;
  moyen: MoyenDepense;
  projet?: string | null;
  /** Compte de trésorerie choisi : il remplace le compte par défaut du moyen. */
  tresorerie?: { numero: string; libelle: string; journal: "BQ" | "CA" } | null;
}): Ecriture {
  const { ht, tva } = decomposerTTC(depense.montant, depense.tauxTvaBp / 100);
  const charge = CATEGORIES_DEPENSE[depense.categorie];
  const tresorerie = depense.tresorerie ?? TRESORERIE[depense.moyen];
  const lignes: LigneEcriture[] = [{ compte: charge.compte, libelleCompte: charge.libelleCompte, debit: ht, credit: 0 }];
  if (tva > 0) {
    lignes.push({ compte: COMPTES.tvaRecuperable.numero, libelleCompte: COMPTES.tvaRecuperable.libelle, debit: tva, credit: 0 });
  }
  lignes.push({ compte: tresorerie.numero, libelleCompte: tresorerie.libelle, debit: 0, credit: depense.montant });

  const ecriture: Ecriture = {
    journal: depense.tresorerie?.journal ?? (depense.moyen === "banque" ? "BQ" : "CA"),
    date: depense.date,
    piece: depense.numero,
    libelle: `${depense.objet}${depense.projet ? ` — ${depense.projet}` : ""}`,
    lignes,
  };
  if (!estEquilibree(ecriture)) throw new Error(`Écriture déséquilibrée sur ${depense.numero}.`);
  return ecriture;
}

// ------------------------------------------------------------------ bilan

/**
 * Bilan d'un projet : ce qu'il a rapporté, ce qu'il a coûté, l'écart avec ce
 * qui était prévu, et s'il a réussi.
 *
 * Tout se compte HORS TAXES : la TVA collectée sur la facture et la TVA
 * récupérée sur l'achat ne sont ni un gain ni une perte. Le budget, lui,
 * reste en TTC — c'est l'argent qui sort de la caisse.
 */
export interface DonneesBilan {
  /** Factures émises rattachées au projet, HT. */
  facture: number;
  /** Ce que les clients ont réellement payé sur ces factures, TTC. */
  encaisse: number;
  /** Dépenses approuvées ou payées, HT. */
  coutEngage: number;
  /** Dépenses payées, HT. */
  coutPaye: number;
  /** Prix de vente convenu, HT. Nul : projet interne ou pas de prix fixé. */
  prixVente: number | null;
  /** Budget TTC et ce qui l'engage, TTC. */
  budget: number | null;
  engageTtc: number;
  /** Échéance prévue et date de fin réelle (ISO). */
  finPrevue: string | null;
  termineLe: string | null;
}

export interface Critere {
  cle: "budget" | "rentabilite" | "delai" | "chiffre";
  libelle: string;
  atteint: boolean;
  detail: string;
}

export interface Bilan {
  /** Facturé moins coûts engagés : positif, bénéfice ; négatif, perte. */
  resultat: number;
  /** Résultat rapporté au facturé, en points de base ; nul sans facturation. */
  margeBp: number | null;
  /** Marge prévue : prix de vente moins coûts engagés. Nulle sans prix. */
  resultatPrevu: number | null;
  ecarts: {
    /** Budget moins engagé (TTC) : négatif, dépassement. */
    budget: number | null;
    /** Facturé moins prix convenu (HT) : négatif, reste à facturer. */
    chiffre: number | null;
    /** Jours de retard (positif) ou d'avance (négatif) sur l'échéance. */
    delaiJours: number | null;
  };
  criteres: Critere[];
  /** Part des critères évaluables qui sont atteints, en %. Nul si aucun ne s'évalue. */
  tauxReussite: number | null;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

function joursEntre(debutIso: string, finIso: string): number {
  return Math.round((Date.parse(`${finIso}T12:00:00Z`) - Date.parse(`${debutIso}T12:00:00Z`)) / JOUR_MS);
}

const f = (n: number) => n.toLocaleString("fr-FR");

export function bilanProjet(d: DonneesBilan, aujourdHui: string): Bilan {
  const resultat = d.facture - d.coutEngage;
  const margeBp = d.facture > 0 ? Math.round((resultat * 10_000) / d.facture) : null;
  const resultatPrevu = d.prixVente === null ? null : d.prixVente - d.coutEngage;

  const ecartBudget = d.budget === null ? null : d.budget - d.engageTtc;
  const ecartChiffre = d.prixVente === null ? null : d.facture - d.prixVente;
  // Un projet terminé se juge à sa date de fin ; un projet en cours, à aujourd'hui
  // — mais seulement une fois l'échéance passée : avant, il n'est pas en retard.
  const reference = d.termineLe ?? aujourdHui;
  const ecartDelai =
    d.finPrevue === null ? null : d.termineLe || reference > d.finPrevue ? joursEntre(d.finPrevue, reference) : null;

  const criteres: Critere[] = [];
  if (ecartBudget !== null) {
    criteres.push({
      cle: "budget",
      libelle: "Budget tenu",
      atteint: ecartBudget >= 0,
      detail: ecartBudget >= 0 ? `${f(ecartBudget)} F de marge sur l'enveloppe` : `${f(-ecartBudget)} F de dépassement`,
    });
  }
  // Un projet en cours se juge sur ce qu'il RAPPORTERA (prix convenu moins
  // coûts engagés) : facturé à moitié, il paraîtrait en perte alors qu'il est
  // simplement en chemin. Terminé, il se juge sur ce qu'il a réellement facturé.
  const termine = d.termineLe !== null;
  const realise = termine || d.prixVente === null;
  if (d.facture > 0 || d.prixVente !== null) {
    const base = realise ? resultat : (resultatPrevu ?? 0);
    criteres.push({
      cle: "rentabilite",
      libelle: realise ? "Projet rentable" : "Rentable au prix convenu",
      atteint: base >= 0,
      detail: base >= 0 ? `${f(base)} F de bénéfice${realise ? "" : " prévu"}` : `${f(-base)} F de perte${realise ? "" : " prévue"}`,
    });
  }
  // Facturer le prix convenu ne se juge qu'à la fin : avant, il reste à facturer, c'est normal.
  if (ecartChiffre !== null && termine) {
    criteres.push({
      cle: "chiffre",
      libelle: "Prix convenu facturé",
      atteint: ecartChiffre >= 0,
      detail: ecartChiffre >= 0 ? "Tout est facturé" : `${f(-ecartChiffre)} F HT jamais facturés`,
    });
  }
  if (d.finPrevue !== null && (d.termineLe !== null || aujourdHui > d.finPrevue)) {
    criteres.push({
      cle: "delai",
      libelle: "Délai tenu",
      atteint: (ecartDelai ?? 0) <= 0,
      detail:
        (ecartDelai ?? 0) <= 0
          ? ecartDelai && ecartDelai < 0
            ? `Terminé ${-ecartDelai} j en avance`
            : "Terminé à l'échéance"
          : `${ecartDelai} j de retard`,
    });
  }

  const atteints = criteres.filter((c) => c.atteint).length;
  return {
    resultat,
    margeBp,
    resultatPrevu,
    ecarts: { budget: ecartBudget, chiffre: ecartChiffre, delaiJours: ecartDelai },
    criteres,
    tauxReussite: criteres.length === 0 ? null : Math.round((atteints * 100) / criteres.length),
  };
}

/**
 * Taux de réussite du portefeuille : parmi les projets TERMINÉS qui
 * s'évaluent, la part qui a tenu tous ses critères. Un projet en cours n'a
 * pas encore réussi ni échoué.
 */
export function tauxReussitePortefeuille(projets: readonly { statut: StatutProjet; bilan: Bilan }[]): {
  evalues: number;
  reussis: number;
  taux: number | null;
} {
  const evalues = projets.filter((p) => p.statut === "termine" && p.bilan.criteres.length > 0);
  const reussis = evalues.filter((p) => p.bilan.criteres.every((c) => c.atteint)).length;
  return { evalues: evalues.length, reussis, taux: evalues.length === 0 ? null : Math.round((reussis * 100) / evalues.length) };
}
