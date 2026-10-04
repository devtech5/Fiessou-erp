import {
  ecritureAvoir,
  ecritureFacture,
  type Ecriture,
  type LignePiece,
} from "@/lib/comptabilite/ecritures";
import { percentOf } from "@/lib/money";
import { montantLigne } from "@/lib/quantite";

/**
 * Calcul d'une pièce commerciale.
 *
 * Logique pure : c'est ici que se décident le montant d'une ligne et les totaux
 * d'une facture. La TVA n'est PAS recalculée à part : elle est lue dans
 * l'écriture que la facture produira. Deux calculs indépendants finiraient par
 * différer d'un franc — la facture remise au client dirait une TVA, le journal
 * une autre, et la déclaration ne retomberait sur aucune des deux.
 */

export interface LigneSaisie {
  designation: string;
  /** En millièmes d'unité. */
  quantite: number;
  /** Prix unitaire hors taxes, en francs entiers. */
  prixUnitaireHt: number;
  /** Remise de ligne en francs entiers. */
  remise: number;
  /** Points de base : 1800 = 18 %. */
  tauxTva: number;
  compteVente: string;
}

export interface TotauxPiece {
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  /** Base et taxe par taux, pour le pied de facture. */
  parTaux: { tauxTva: number; base: number; tva: number }[];
}

const LIBELLE_COMPTE: Record<string, string> = {
  "701": "Ventes de marchandises",
  "706": "Services vendus",
  "707": "Ventes de produits accessoires",
};

/** Montant hors taxes d'une ligne, remise déduite. Jamais négatif. */
export function montantHtLigne(
  ligne: Pick<LigneSaisie, "quantite" | "prixUnitaireHt" | "remise">,
): number {
  return Math.max(0, montantLigne(ligne.prixUnitaireHt, ligne.quantite) - ligne.remise);
}

/** Lignes au format du moteur d'écritures (taux en pour cent). */
export function versLignesPiece(lignes: LigneSaisie[]): LignePiece[] {
  return lignes.map((ligne) => ({
    designation: ligne.designation,
    montantHT: montantHtLigne(ligne),
    tauxTVA: ligne.tauxTva / 100,
    compte: ligne.compteVente,
    libelleCompte: LIBELLE_COMPTE[ligne.compteVente] ?? "Ventes",
  }));
}

/**
 * Écriture que la pièce produira à l'émission.
 *
 * Facture : 411 au débit pour le TTC, produits et TVA au crédit. Avoir :
 * l'inverse. Un devis n'en produit pas — il n'engage rien.
 */
export function ecritureDePiece(piece: {
  nature: "facture" | "avoir";
  numero: string;
  date: string;
  client: string;
  compteAuxiliaire: string;
  lignes: LigneSaisie[];
}): Ecriture {
  const source = {
    numero: piece.numero,
    date: piece.date,
    client: piece.client,
    compteAuxiliaire: piece.compteAuxiliaire,
    lignes: versLignesPiece(piece.lignes),
  };
  return piece.nature === "avoir" ? ecritureAvoir(source) : ecritureFacture(source);
}

/**
 * Totaux d'une pièce, cohérents au franc près avec son écriture.
 *
 * La TVA est calculée par groupe (compte, taux), exactement comme le moteur
 * d'écritures la passe au journal.
 */
export function totaliserPiece(lignes: LigneSaisie[]): TotauxPiece {
  const totalHt = lignes.reduce((somme, ligne) => somme + montantHtLigne(ligne), 0);

  if (lignes.length === 0 || totalHt === 0) {
    return { totalHt, totalTva: 0, totalTtc: totalHt, parTaux: [] };
  }

  const ecriture = ecritureFacture({
    numero: "CALCUL",
    date: "2000-01-01",
    client: "",
    compteAuxiliaire: "",
    lignes: versLignesPiece(lignes),
  });

  const totalTtc = ecriture.lignes[0].debit;
  const totalTva = totalTtc - totalHt;

  // Base et taxe par taux, avec le même groupement (compte, taux) que le
  // journal : la somme des taxes par taux retombe sur le total.
  const groupes = new Map<string, { tauxTva: number; base: number }>();
  for (const ligne of lignes) {
    const cle = `${ligne.compteVente}|${ligne.tauxTva}`;
    const groupe = groupes.get(cle) ?? { tauxTva: ligne.tauxTva, base: 0 };
    groupe.base += montantHtLigne(ligne);
    groupes.set(cle, groupe);
  }

  const parTauxMap = new Map<number, { tauxTva: number; base: number; tva: number }>();
  for (const groupe of groupes.values()) {
    // Même formule que le moteur d'écritures, au caractère près.
    const tva = percentOf(groupe.base, groupe.tauxTva / 100);
    const cumul = parTauxMap.get(groupe.tauxTva) ?? { tauxTva: groupe.tauxTva, base: 0, tva: 0 };
    cumul.base += groupe.base;
    cumul.tva += tva;
    parTauxMap.set(groupe.tauxTva, cumul);
  }

  return {
    totalHt,
    totalTva,
    totalTtc,
    parTaux: [...parTauxMap.values()].sort((a, b) => b.tauxTva - a.tauxTva),
  };
}

/** Reste dû sur une facture, d'après les règlements reçus. Jamais négatif. */
export function resteDu(totalTtc: number, regle: number): number {
  return Math.max(0, totalTtc - regle);
}

/**
 * Échéance d'une facture : date de la pièce + délai du client, en jours.
 * Calculée à midi UTC pour ne jamais basculer la veille.
 */
export function echeanceDe(dateIso: string, delaiJours: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(0, delaiJours));
  return date.toISOString().slice(0, 10);
}

/** Préfixe de numérotation par nature. */
export const PREFIXE_PIECE = { devis: "DEV", facture: "FAC", avoir: "AVO" } as const;
