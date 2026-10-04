import { ecritureAchat, type CodeJournal, type Ecriture } from "@/lib/comptabilite/ecritures";
import { montantLigne } from "@/lib/quantite";

/**
 * Achats : règles pures, sans base ni React. Importable depuis le navigateur.
 *
 * Le circuit suit le papier du terrain : bon de commande au fournisseur,
 * bon de réception au dépôt, facture du fournisseur, règlement. Chaque étape
 * vérifie la précédente — on ne paie que ce qui a été facturé, on ne se laisse
 * facturer que ce qui a été reçu.
 */

export type StatutCommande = "brouillon" | "envoyee" | "partielle" | "recue" | "annulee";

export const LIBELLE_STATUT_COMMANDE: Record<StatutCommande, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  partielle: "Reçue en partie",
  recue: "Reçue",
  annulee: "Annulée",
};

export interface LigneAchat {
  designation: string;
  /** En millièmes d'unité. */
  quantite: number;
  /** Prix unitaire hors taxes, en francs entiers. */
  prixUnitaireHt: number;
  /** Points de base : 1800 = 18 %. */
  tauxTva: number;
  /** Compte de charge ou d'achat : 601, 604, 605, 622… */
  compteAchat: string;
}

/** Comptes d'achat et de charges proposés à la saisie d'une facture fournisseur. */
export const COMPTES_ACHAT: Record<string, string> = {
  "601": "Achats de marchandises",
  "602": "Achats de matières premières",
  "604": "Achats stockés de matières et fournitures",
  "605": "Autres achats",
  "6051": "Eau",
  "6052": "Électricité",
  "6053": "Autres énergies",
  "6055": "Fournitures de bureau",
  "611": "Transports sur achats",
  "622": "Locations et charges locatives",
  "624": "Entretien, réparations et maintenance",
  "625": "Primes d'assurance",
  "627": "Publicité, publications, relations publiques",
  "628": "Frais de télécommunications",
  "632": "Rémunérations d'intermédiaires et de conseils",
  "638": "Autres charges externes",
};

export function libelleCompteAchat(compte: string): string {
  return COMPTES_ACHAT[compte] ?? "Achats";
}

/** Montant hors taxes d'une ligne. Jamais négatif. */
export function montantHt(ligne: Pick<LigneAchat, "quantite" | "prixUnitaireHt">): number {
  return Math.max(0, montantLigne(ligne.prixUnitaireHt, ligne.quantite));
}

/**
 * Écriture d'une facture fournisseur.
 *
 *   6xx  Achats / charges     débit   HT, par compte
 *   4451 TVA récupérable      débit   TVA
 *   401  Fournisseur          crédit  TTC
 *
 * Les totaux de la facture SORTENT de cette écriture : un total calculé à part
 * finirait par différer d'un franc de ce que dit le journal.
 */
export function ecritureFactureFournisseur(f: {
  numero: string;
  date: string;
  fournisseur: string;
  compteAuxiliaire: string;
  lignes: LigneAchat[];
}): Ecriture {
  if (f.lignes.length === 0) throw new Error("Une facture sans ligne ne s'enregistre pas.");
  return ecritureAchat({
    numero: f.numero,
    date: f.date,
    fournisseur: f.fournisseur,
    compteAuxiliaire: f.compteAuxiliaire,
    lignes: f.lignes.map((l) => ({
      designation: l.designation,
      montantHT: montantHt(l),
      tauxTVA: l.tauxTva / 100,
      compte: l.compteAchat,
      libelleCompte: libelleCompteAchat(l.compteAchat),
    })),
  });
}

/** Totaux d'un ensemble de lignes, lus dans l'écriture qu'elles produiraient. */
export function totaux(lignes: LigneAchat[]): { totalHt: number; totalTva: number; totalTtc: number } {
  if (lignes.length === 0 || lignes.every((l) => montantHt(l) === 0)) return { totalHt: 0, totalTva: 0, totalTtc: 0 };
  const e = ecritureFactureFournisseur({ numero: "-", date: "2000-01-01", fournisseur: "-", compteAuxiliaire: "-", lignes });
  const totalTtc = e.lignes.find((l) => l.compte === "401")?.credit ?? 0;
  const totalTva = e.lignes.find((l) => l.compte === "4451")?.debit ?? 0;
  return { totalHt: totalTtc - totalTva, totalTva, totalTtc };
}

/**
 * Règlement d'un fournisseur.
 *
 *   401 Fournisseur     débit   montant
 *   5xx Trésorerie      crédit  montant
 */
export function ecritureReglementFournisseur(r: {
  numero: string;
  date: string;
  fournisseur: string;
  compteAuxiliaire: string;
  facture: string;
  montant: number;
  tresorerie: { numero: string; libelle: string; journal: CodeJournal };
}): Ecriture {
  if (!Number.isInteger(r.montant) || r.montant <= 0) throw new Error("Montant invalide.");
  return {
    journal: r.tresorerie.journal,
    date: r.date,
    piece: r.numero,
    libelle: `Règlement ${r.numero} — ${r.fournisseur}, facture ${r.facture}`,
    lignes: [
      { compte: "401", libelleCompte: "Fournisseurs", auxiliaire: r.compteAuxiliaire, debit: r.montant, credit: 0 },
      { compte: r.tresorerie.numero, libelleCompte: r.tresorerie.libelle, debit: 0, credit: r.montant },
    ],
  };
}

// ------------------------------------------------------------------ réception

export interface LigneCommandeSuivie {
  id: string;
  quantite: number;
  /** Déjà reçu, toutes réceptions confondues. */
  recue: number;
}

export function resteARecevoir(l: LigneCommandeSuivie): number {
  return Math.max(0, l.quantite - l.recue);
}

/**
 * Refus d'une réception : rien à recevoir, quantité négative, ou plus que ce
 * qui reste commandé. Un surplus livré se refuse au quai ou fait l'objet d'une
 * nouvelle commande : l'accepter ici gonflerait le stock d'une marchandise
 * que personne n'a décidé d'acheter.
 */
export function refusReception(lignes: readonly LigneCommandeSuivie[], recues: Readonly<Record<string, number>>): string | null {
  const saisies = Object.entries(recues).filter(([, q]) => q !== 0);
  if (saisies.length === 0) return "Indiquez au moins une quantité reçue.";
  for (const [id, q] of saisies) {
    const ligne = lignes.find((l) => l.id === id);
    if (!ligne) return "Ligne de commande inconnue.";
    if (!Number.isInteger(q) || q < 0) return "Quantité reçue invalide.";
    if (q > resteARecevoir(ligne)) return "Une quantité reçue dépasse ce qui reste à recevoir.";
  }
  return null;
}

/** Statut d'une commande après réception : reçue quand plus rien ne manque. */
export function statutApresReception(lignes: readonly LigneCommandeSuivie[]): "partielle" | "recue" {
  return lignes.every((l) => resteARecevoir(l) === 0) ? "recue" : "partielle";
}

// --------------------------------------------------------- rapprochement 3 voies

export interface EcartFacture {
  designation: string;
  nature: "quantite" | "prix";
  commande: number;
  facture: number;
}

/**
 * Contrôle d'une facture fournisseur face à la commande et à la réception :
 * on ne se laisse pas facturer plus que reçu, ni plus cher que commandé.
 * Rend les écarts ; l'écran les montre avant validation.
 */
export function ecartsFacture(
  lignes: readonly {
    designation: string;
    quantiteRecue: number;
    prixCommande: number;
    quantiteFacturee: number;
    prixFacture: number;
  }[],
): EcartFacture[] {
  const ecarts: EcartFacture[] = [];
  for (const l of lignes) {
    if (l.quantiteFacturee > l.quantiteRecue) {
      ecarts.push({ designation: l.designation, nature: "quantite", commande: l.quantiteRecue, facture: l.quantiteFacturee });
    }
    if (l.prixFacture > l.prixCommande) {
      ecarts.push({ designation: l.designation, nature: "prix", commande: l.prixCommande, facture: l.prixFacture });
    }
  }
  return ecarts;
}

// ------------------------------------------------------------------ échéances

const plusJours = (iso: string, jours: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10);

/** Échéance par défaut d'une facture fournisseur : trente jours date de facture. */
export function echeanceParDefaut(dateFacture: string, jours = 30): string {
  return plusJours(dateFacture, jours);
}

export type EtatDette = "a_payer" | "bientot" | "echue" | "soldee";

/** État d'une dette : échue, à payer sous sept jours, à payer, soldée. */
export function etatDette(reste: number, echeance: string, aujourdhui: string): EtatDette {
  if (reste <= 0) return "soldee";
  if (echeance < aujourdhui) return "echue";
  if (echeance <= plusJours(aujourdhui, 7)) return "bientot";
  return "a_payer";
}

/** Un règlement ne dépasse jamais ce qui reste dû : un trop-payé ne s'enregistre pas en silence. */
export function refusReglement(reste: number, montant: number): string | null {
  if (!Number.isInteger(montant) || montant <= 0) return "Montant invalide.";
  if (montant > reste) return `Le règlement dépasse le reste dû (${reste.toLocaleString("fr-FR")} F).`;
  return null;
}
