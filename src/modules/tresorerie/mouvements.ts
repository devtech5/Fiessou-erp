import type { Ecriture, LigneEcriture } from "@/lib/comptabilite/ecritures";

import { journalDe, type CompteRef } from "./calcul";

/**
 * Mouvements libres sur un compte de trésorerie : ce qui entre ou sort sans
 * passer par une facture, une dépense ou un virement interne.
 *
 * Un client qui vire sans facture, un prestataire payé par ordre de virement,
 * un apport de l'associé, un prêt de la banque. Chaque nature fixe sa
 * contrepartie : le caissier choisit « emprunt », pas « 162 ».
 *
 * Ce fichier ne dépend de rien : il se teste sans base.
 */

export type NatureMouvement =
  | "client"
  | "fournisseur"
  | "remboursement_client"
  | "apport"
  | "emprunt"
  | "remboursement_emprunt"
  | "frais_bancaires"
  | "produit_financier"
  | "autre_entree"
  | "autre_sortie";

export type SensMouvement = "entree" | "sortie";

interface DefinitionNature {
  libelle: string;
  sens: SensMouvement;
  /** Contrepartie générale, ou le tiers dont le compte auxiliaire porte le mouvement. */
  contrepartie: { numero: string; libelle: string } | { tiers: "client" | "fournisseur" };
  aide: string;
}

/** Compte d'attente : le comptable reclasse ce que personne n'a su nommer. */
export const COMPTE_ATTENTE = { numero: "4711", libelle: "Compte d'attente — mouvements à reclasser" } as const;

export const NATURES_MOUVEMENT: Record<NatureMouvement, DefinitionNature> = {
  client: {
    libelle: "Versement d'un client",
    sens: "entree",
    contrepartie: { tiers: "client" },
    aide: "Virement, chèque ou dépôt d'un client, avec ou sans facture. Il vient en déduction de ce qu'il doit ; sans facture, il reste à son crédit jusqu'au lettrage.",
  },
  fournisseur: {
    libelle: "Paiement d'un fournisseur ou prestataire",
    sens: "sortie",
    contrepartie: { tiers: "fournisseur" },
    aide: "Ordre de virement, chèque ou versement à un fournisseur ou à un prestataire. Il solde ses factures au lettrage.",
  },
  remboursement_client: {
    libelle: "Remboursement à un client",
    sens: "sortie",
    contrepartie: { tiers: "client" },
    aide: "Trop-perçu ou avoir rendu à un client.",
  },
  apport: {
    libelle: "Apport de l'associé",
    sens: "entree",
    contrepartie: { numero: "462", libelle: "Associés, comptes courants" },
    aide: "Argent mis par le propriétaire ou un associé. Il pourra le reprendre : c'est une dette de l'entreprise envers lui.",
  },
  emprunt: {
    libelle: "Prêt reçu (banque, microfinance)",
    sens: "entree",
    contrepartie: { numero: "162", libelle: "Emprunts auprès des établissements de crédit" },
    aide: "Le capital versé par la banque ou l'institution de microfinance.",
  },
  remboursement_emprunt: {
    libelle: "Remboursement de prêt",
    sens: "sortie",
    contrepartie: { numero: "162", libelle: "Emprunts auprès des établissements de crédit" },
    aide: "La part de capital de l'échéance. Les intérêts se saisissent à part, en frais bancaires.",
  },
  frais_bancaires: {
    libelle: "Frais et agios bancaires",
    sens: "sortie",
    contrepartie: { numero: "631", libelle: "Frais bancaires" },
    aide: "Tenue de compte, commissions, agios, intérêts d'emprunt, frais mobile money.",
  },
  produit_financier: {
    libelle: "Intérêts reçus",
    sens: "entree",
    contrepartie: { numero: "771", libelle: "Intérêts et produits financiers" },
    aide: "Intérêts versés par la banque sur un compte rémunéré.",
  },
  autre_entree: {
    libelle: "Autre entrée",
    sens: "entree",
    contrepartie: COMPTE_ATTENTE,
    aide: "Ce qui n'entre dans aucune case. Le comptable le reclassera : dites-lui de quoi il s'agit dans le libellé.",
  },
  autre_sortie: {
    libelle: "Autre sortie",
    sens: "sortie",
    contrepartie: COMPTE_ATTENTE,
    aide: "Ce qui n'entre dans aucune case. Le comptable le reclassera : dites-lui de quoi il s'agit dans le libellé.",
  },
};

export function natureConnue(cle: string): cle is NatureMouvement {
  return cle in NATURES_MOUVEMENT;
}

/** Le tiers qu'exige la nature, s'il en faut un. */
export function tiersRequis(nature: NatureMouvement): "client" | "fournisseur" | null {
  const c = NATURES_MOUVEMENT[nature].contrepartie;
  return "tiers" in c ? c.tiers : null;
}

/**
 * Écriture d'un mouvement.
 *
 *   entrée :  5xx Trésorerie   débit  / contrepartie  crédit
 *   sortie :  contrepartie     débit  / 5xx Trésorerie crédit
 *
 * Un mouvement avec un tiers porte son compte auxiliaire : c'est ce qui permet
 * de le lettrer ensuite avec la facture qu'il règle.
 */
export function ecritureMouvement(m: {
  numero: string;
  date: string;
  compte: CompteRef;
  nature: NatureMouvement;
  montant: number;
  libelle: string;
  tiers?: { nom: string; auxiliaire: string } | null;
}): Ecriture {
  if (!Number.isInteger(m.montant) || m.montant <= 0) throw new Error("Montant invalide.");
  const definition = NATURES_MOUVEMENT[m.nature];
  const besoin = tiersRequis(m.nature);
  if (besoin && !m.tiers) throw new Error(besoin === "client" ? "Choisissez le client." : "Choisissez le fournisseur ou le prestataire.");

  const contrepartie: LigneEcriture =
    "tiers" in definition.contrepartie
      ? {
          compte: definition.contrepartie.tiers === "client" ? "411" : "401",
          libelleCompte: definition.contrepartie.tiers === "client" ? "Clients" : "Fournisseurs",
          auxiliaire: m.tiers!.auxiliaire,
          debit: 0,
          credit: 0,
        }
      : { compte: definition.contrepartie.numero, libelleCompte: definition.contrepartie.libelle, debit: 0, credit: 0 };
  const tresorerie: LigneEcriture = { compte: m.compte.numero, libelleCompte: m.compte.libelle, debit: 0, credit: 0 };

  if (definition.sens === "entree") {
    tresorerie.debit = m.montant;
    contrepartie.credit = m.montant;
  } else {
    contrepartie.debit = m.montant;
    tresorerie.credit = m.montant;
  }

  const qui = m.tiers ? ` — ${m.tiers.nom}` : "";
  return {
    journal: journalDe(m.compte.nature),
    date: m.date,
    piece: m.numero,
    libelle: `${m.libelle || definition.libelle}${qui}`.slice(0, 200),
    lignes: definition.sens === "entree" ? [tresorerie, contrepartie] : [contrepartie, tresorerie],
  };
}

// ----------------------------------------------------------------- relevé

export interface LigneReleveInterne {
  date: string;
  piece: string;
  libelle: string;
  origine: string;
  entree: number;
  sortie: number;
}

/**
 * Relevé d'un compte : chaque opération et le solde après elle, à partir du
 * solde d'ouverture de la période.
 */
export function releveAvecSolde(ouverture: number, lignes: readonly LigneReleveInterne[]): (LigneReleveInterne & { solde: number })[] {
  let solde = ouverture;
  return lignes.map((l) => {
    solde += l.entree - l.sortie;
    return { ...l, solde };
  });
}
