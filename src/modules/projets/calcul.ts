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
}): Ecriture {
  const { ht, tva } = decomposerTTC(depense.montant, depense.tauxTvaBp / 100);
  const charge = CATEGORIES_DEPENSE[depense.categorie];
  const tresorerie = TRESORERIE[depense.moyen];
  const lignes: LigneEcriture[] = [{ compte: charge.compte, libelleCompte: charge.libelleCompte, debit: ht, credit: 0 }];
  if (tva > 0) {
    lignes.push({ compte: COMPTES.tvaRecuperable.numero, libelleCompte: COMPTES.tvaRecuperable.libelle, debit: tva, credit: 0 });
  }
  lignes.push({ compte: tresorerie.numero, libelleCompte: tresorerie.libelle, debit: 0, credit: depense.montant });

  const ecriture: Ecriture = {
    journal: depense.moyen === "banque" ? "BQ" : "CA",
    date: depense.date,
    piece: depense.numero,
    libelle: `${depense.objet}${depense.projet ? ` — ${depense.projet}` : ""}`,
    lignes,
  };
  if (!estEquilibree(ecriture)) throw new Error(`Écriture déséquilibrée sur ${depense.numero}.`);
  return ecriture;
}
