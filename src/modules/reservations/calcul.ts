import {
  COMPTES,
  decomposerTTC,
  estEquilibree,
  type Ecriture,
  type LigneEcriture,
} from "@/lib/comptabilite/ecritures";

import type { MoyenLocation } from "./schema";

/**
 * Règles de la réservation de ressource.
 *
 * Logique pure : durée, tarif, disponibilité, écritures. Le serveur les
 * applique, les tests les figent, l'écran les relit.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours d'une période INCLUSIVE : du 20 au 27, huit jours. */
export function joursEntre(debutIso: string, finIso: string): number {
  const debut = Date.parse(`${debutIso}T12:00:00Z`);
  const fin = Date.parse(`${finIso}T12:00:00Z`);
  return Math.round((fin - debut) / JOUR_MS) + 1;
}

/** Ajoute des jours à une date ISO, à midi UTC pour ne jamais basculer la veille. */
export function ajouterJours(dateIso: string, jours: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

export interface Grille {
  tarifJour: number | null;
  tarifSemaine: number | null;
  tarifMois: number | null;
}

export type BaseTarif = "jour" | "semaine" | "mois";

/**
 * Prix d'une période pour UN exemplaire.
 *
 * La grille bascule sur le forfait dès qu'il s'applique, et le reliquat se
 * paie au tarif inférieur : 10 jours = 1 semaine + 3 jours. Multiplier le
 * tarif journalier ferait coûter une location d'un mois plus cher que le
 * matériel lui-même. Inversement, on n'arrondit jamais au forfait supérieur :
 * personne ne paie une semaine pour cinq jours.
 *
 * Rend `null` quand la grille ne sert aucune durée exploitable — une salle
 * sans tarif journalier ne se loue pas trois jours.
 */
export function prixPeriode(
  grille: Grille,
  jours: number,
): { montant: number; base: BaseTarif } | null {
  if (jours <= 0) return null;

  let reste = jours;
  let montant = 0;
  let base: BaseTarif = "jour";

  if (grille.tarifMois && reste >= 30) {
    montant += Math.floor(reste / 30) * grille.tarifMois;
    reste %= 30;
    base = "mois";
  }
  if (grille.tarifSemaine && reste >= 7) {
    montant += Math.floor(reste / 7) * grille.tarifSemaine;
    reste %= 7;
    if (base === "jour") base = "semaine";
  }
  if (reste > 0) {
    if (grille.tarifJour) montant += reste * grille.tarifJour;
    else if (grille.tarifSemaine && reste < 7) montant += grille.tarifSemaine;
    else if (grille.tarifMois) montant += grille.tarifMois;
    else return null;
  }

  return { montant, base };
}

export interface Occupation {
  debut: string;
  fin: string;
  quantite: number;
}

/** Exemplaires pris un jour donné. */
export function prisLe(occupations: Occupation[], jourIso: string): number {
  return occupations
    .filter((o) => o.debut <= jourIso && jourIso <= o.fin)
    .reduce((somme, o) => somme + o.quantite, 0);
}

/**
 * Plus forte occupation sur une période : c'est elle qui décide si un
 * nouveau contrat tient. Un lot de chaises libre lundi et pris mardi n'est
 * pas disponible « du lundi au mercredi ».
 */
export function occupationMax(occupations: Occupation[], debut: string, fin: string): number {
  let max = 0;
  for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
    max = Math.max(max, prisLe(occupations, jour));
  }
  return max;
}

// --------------------------------------------------------------- écritures

const TRESORERIE: Record<MoyenLocation, { numero: string; libelle: string }> = {
  especes: COMPTES.caisse,
  mobile_money: COMPTES.caisseMobileMoney,
  banque: COMPTES.banque,
};

/** Dépôts et cautionnements reçus : une dette envers le client, pas un produit. */
export const COMPTE_CAUTIONS = { numero: "165", libelle: "Dépôts et cautionnements reçus" };
/** Retenue sur caution : dégât, perte ou retard. Seule part qui devient recette. */
export const COMPTE_RETENUES = { numero: "758", libelle: "Produits divers — retenues sur caution" };

const COMPTE_CAUTIONS_LIGNE = { compte: COMPTE_CAUTIONS.numero, libelleCompte: COMPTE_CAUTIONS.libelle };

function exiger(ecriture: Ecriture): Ecriture {
  if (!estEquilibree(ecriture)) throw new Error(`Écriture déséquilibrée sur ${ecriture.piece}.`);
  return ecriture;
}

/**
 * Remise du bien : le client paie la location et dépose la caution.
 *
 *   5xx Trésorerie   débit   location + caution
 *   706 Services     crédit  location HT
 *   4431 TVA         crédit  taxe sur la location
 *   165 Cautions     crédit  caution détenue
 *
 * La caution n'entre jamais au chiffre d'affaires : elle se rend.
 */
export function ecritureRemise(piece: {
  numero: string;
  date: string;
  client: string;
  montantTtc: number;
  tauxTvaBp: number;
  caution: number;
  moyen: MoyenLocation;
}): Ecriture {
  const { ht, tva } = decomposerTTC(piece.montantTtc, piece.tauxTvaBp / 100);
  const tresorerie = TRESORERIE[piece.moyen];
  const lignes: LigneEcriture[] = [
    {
      compte: tresorerie.numero,
      libelleCompte: tresorerie.libelle,
      debit: piece.montantTtc + piece.caution,
      credit: 0,
    },
  ];
  if (ht > 0) lignes.push({ compte: COMPTES.servicesVendus.numero, libelleCompte: COMPTES.servicesVendus.libelle, debit: 0, credit: ht });
  if (tva > 0) lignes.push({ compte: COMPTES.tvaFacturee.numero, libelleCompte: COMPTES.tvaFacturee.libelle, debit: 0, credit: tva });
  if (piece.caution > 0) lignes.push({ ...COMPTE_CAUTIONS_LIGNE, debit: 0, credit: piece.caution });

  return exiger({
    journal: piece.moyen === "banque" ? "BQ" : "CA",
    date: piece.date,
    piece: piece.numero,
    libelle: `Location ${piece.numero} — ${piece.client}`,
    lignes,
  });
}

/**
 * Restitution : la caution se rend, moins la retenue.
 *
 *   165 Cautions     débit   caution détenue
 *   5xx Trésorerie   crédit  caution rendue
 *   758 Produits     crédit  retenue
 */
export function ecritureRestitution(piece: {
  numero: string;
  date: string;
  client: string;
  caution: number;
  retenue: number;
  moyen: MoyenLocation;
}): Ecriture | null {
  if (piece.caution === 0) return null;
  if (piece.retenue < 0 || piece.retenue > piece.caution) {
    throw new Error("La retenue ne peut dépasser la caution.");
  }
  const tresorerie = TRESORERIE[piece.moyen];
  const rendu = piece.caution - piece.retenue;
  const lignes: LigneEcriture[] = [{ ...COMPTE_CAUTIONS_LIGNE, debit: piece.caution, credit: 0 }];
  if (rendu > 0) lignes.push({ compte: tresorerie.numero, libelleCompte: tresorerie.libelle, debit: 0, credit: rendu });
  if (piece.retenue > 0) {
    lignes.push({ compte: COMPTE_RETENUES.numero, libelleCompte: COMPTE_RETENUES.libelle, debit: 0, credit: piece.retenue });
  }

  return exiger({
    journal: piece.moyen === "banque" ? "BQ" : "CA",
    date: piece.date,
    piece: `${piece.numero}-R`,
    libelle: `Restitution ${piece.numero} — ${piece.client}`,
    lignes,
  });
}

// ------------------------------------------------------------- abonnements

/**
 * Un adhérent peut-il entrer aujourd'hui ? Deux régimes, deux raisons de
 * refuser : au forfait la date compte, à la séance le solde compte.
 * Confondre les deux, c'est refuser l'entrée à quelqu'un qui a payé.
 */
export function accesAbonnement(abonnement: {
  debut: string;
  fin: string;
  seancesIncluses: number | null;
  seancesConsommees: number;
}, aujourdHui: string): { ok: true; restantes: number | null } | { ok: false; raison: string } {
  if (aujourdHui < abonnement.debut) return { ok: false, raison: "L'abonnement n'a pas encore commencé." };
  if (aujourdHui > abonnement.fin) return { ok: false, raison: "Abonnement expiré : à renouveler." };
  if (abonnement.seancesIncluses !== null) {
    const restantes = abonnement.seancesIncluses - abonnement.seancesConsommees;
    if (restantes <= 0) return { ok: false, raison: "Plus aucune séance : à renouveler." };
    return { ok: true, restantes: restantes - 1 };
  }
  return { ok: true, restantes: null };
}
