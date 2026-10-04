import { COMPTES, estEquilibree, type Ecriture, type LigneEcriture } from "@/lib/comptabilite/ecritures";

import type { Reseau, TypeOperationGuichet } from "./schema";

/**
 * Règles du guichet de monnaie électronique.
 *
 * Logique pure : effet des opérations sur les deux réserves, contrôle avant
 * validation, rapprochement et écriture de clôture.
 */

export const RESEAUX: readonly Reseau[] = ["wave", "orange", "mtn", "moov"];

export const NOM_RESEAU: Record<Reseau, string> = {
  wave: "Wave",
  orange: "Orange Money",
  mtn: "MTN MoMo",
  moov: "Moov Money",
};

export const LIBELLE_OPERATION: Record<TypeOperationGuichet, string> = {
  depot: "Dépôt",
  retrait: "Retrait",
  credit: "Crédit",
  approvisionnement: "Approvisionnement",
  destockage: "Déstockage",
};

/** Seuil sous lequel un float ne permet plus d'absorber les opérations courantes. */
export const SEUIL_FLOAT_BAS = 150_000;

/**
 * Sens de l'opération sur le float : +1 il monte, −1 il baisse. Les espèces
 * vont toujours dans l'autre sens — c'est l'invariant du guichet.
 */
const SENS_FLOAT: Record<TypeOperationGuichet, 1 | -1> = {
  depot: -1,
  retrait: 1,
  credit: -1,
  approvisionnement: 1,
  destockage: -1,
};

export function effetSurFloat(type: TypeOperationGuichet, montant: number): number {
  return SENS_FLOAT[type] * montant;
}

export function effetSurEspeces(type: TypeOperationGuichet, montant: number): number {
  return -SENS_FLOAT[type] * montant;
}

export interface OperationComptee {
  type: TypeOperationGuichet;
  reseau: Reseau;
  montant: number;
  commission: number;
  /** Une opération annulée ne compte plus nulle part. */
  annulee?: boolean;
}

export interface Soldes {
  floats: Record<Reseau, number>;
  especes: number;
  commissions: number;
}

/**
 * Soldes courants, déduits de l'ouverture et des opérations.
 *
 * Déduits plutôt que saisis : un solde tenu à côté des opérations qui le
 * produisent finit toujours par diverger.
 */
export function soldes(
  ouverture: { floats: Partial<Record<Reseau, number>>; fondCaisse: number },
  operations: readonly OperationComptee[],
): Soldes {
  const floats = Object.fromEntries(RESEAUX.map((r) => [r, ouverture.floats[r] ?? 0])) as Record<Reseau, number>;
  let especes = ouverture.fondCaisse;
  let commissions = 0;

  for (const op of operations) {
    if (op.annulee) continue;
    floats[op.reseau] += effetSurFloat(op.type, op.montant);
    especes += effetSurEspeces(op.type, op.montant);
    commissions += op.commission;
  }
  return { floats, especes, commissions };
}

/**
 * Raison de refuser une opération, ou `null` si elle passe.
 *
 * Accepter un dépôt que le float ne couvre pas, c'est encaisser le client puis
 * voir l'envoi échouer chez l'opérateur ; accepter un retrait que le tiroir ne
 * couvre pas, c'est promettre des billets qu'on n'a pas.
 */
export function refusOperation(courants: Soldes, op: Pick<OperationComptee, "type" | "reseau" | "montant">): string | null {
  if (!Number.isInteger(op.montant) || op.montant <= 0) return "Montant invalide.";
  const float = courants.floats[op.reseau] + effetSurFloat(op.type, op.montant);
  if (float < 0) {
    return `Float ${NOM_RESEAU[op.reseau]} insuffisant : ${courants.floats[op.reseau].toLocaleString("fr-FR")} F disponibles.`;
  }
  const especes = courants.especes + effetSurEspeces(op.type, op.montant);
  if (especes < 0) {
    return `Espèces insuffisantes en caisse : ${courants.especes.toLocaleString("fr-FR")} F dans le tiroir.`;
  }
  return null;
}

/**
 * Barème indicatif de commission, pour préremplir la saisie.
 *
 * Chaque opérateur publie sa propre grille et la révise : l'agent corrige le
 * chiffre au guichet, c'est le montant saisi qui est enregistré.
 */
const TRANCHES = [
  { jusqua: 5_000, commission: 50 },
  { jusqua: 10_000, commission: 100 },
  { jusqua: 25_000, commission: 250 },
  { jusqua: 50_000, commission: 300 },
  { jusqua: 100_000, commission: 500 },
  { jusqua: 200_000, commission: 1_000 },
  { jusqua: Number.POSITIVE_INFINITY, commission: 1_500 },
];

export function commissionIndicative(type: TypeOperationGuichet, montant: number): number {
  if (montant <= 0) return 0;
  // Les mouvements de trésorerie de l'agent ne rapportent rien.
  if (type === "approvisionnement" || type === "destockage") return 0;
  // Le crédit d'appel se vend avec une remise de l'ordre de 5 %.
  if (type === "credit") return Math.floor(montant / 20);
  return TRANCHES.find((t) => montant <= t.jusqua)!.commission;
}

// ----------------------------------------------------------- rapprochement

export interface Rapprochement {
  especesAttendues: number;
  especesComptees: number;
  /** Compté moins attendu : négatif, il manque de l'argent. */
  ecartEspeces: number;
  floats: { reseau: Reseau; attendu: number; releve: number | null; ecart: number | null }[];
}

export function rapprocher(
  courants: Soldes,
  especesComptees: number,
  releves: Partial<Record<Reseau, number | null>>,
): Rapprochement {
  return {
    especesAttendues: courants.especes,
    especesComptees,
    ecartEspeces: especesComptees - courants.especes,
    floats: RESEAUX.map((reseau) => {
      const releve = releves[reseau] ?? null;
      return {
        reseau,
        attendu: courants.floats[reseau],
        releve,
        ecart: releve === null ? null : releve - courants.floats[reseau],
      };
    }),
  };
}

// --------------------------------------------------------------- écriture

/** Float détenu chez les opérateurs : de la trésorerie, suivie réseau par réseau. */
export const COMPTE_FLOAT = { numero: "5712", libelle: "Monnaie électronique — float agent" };
/** Commissions acquises, que l'opérateur verse en fin de période. */
export const COMPTE_COMMISSIONS_A_RECEVOIR = { numero: "4718", libelle: "Opérateurs — commissions à recevoir" };

/**
 * Écriture de clôture d'une session.
 *
 *   5712 Float (par réseau)   variation de la journée
 *   571  Caisse               variation des espèces réellement comptées
 *   658 / 758                 manquant ou excédent constaté au comptage
 *   4718 / 706                commissions acquises sur la journée
 *
 * Une écriture par session et non par opération : un kiosque passe des
 * centaines d'opérations par jour, et le journal deviendrait illisible pour
 * un résultat identique.
 *
 * Les dépôts et retraits ne sont pas un chiffre d'affaires : ils déplacent de
 * la valeur entre deux comptes de trésorerie. Seule la commission est un
 * produit. Un écart de float n'est PAS passé ici : il signale une opération
 * oubliée, qu'il faut retrouver et saisir, pas absorber.
 */
export function ecritureClotureGuichet(cloture: {
  numero: string;
  date: string;
  variationsFloat: Partial<Record<Reseau, number>>;
  commissions: number;
  ecartEspeces: number;
}): Ecriture | null {
  const lignes: LigneEcriture[] = [];
  const poser = (compte: { numero: string; libelle: string }, montant: number, auxiliaire?: string) => {
    if (montant === 0) return;
    lignes.push({
      compte: compte.numero,
      libelleCompte: compte.libelle,
      ...(auxiliaire ? { auxiliaire } : {}),
      debit: montant > 0 ? montant : 0,
      credit: montant < 0 ? -montant : 0,
    });
  };

  let variationFloats = 0;
  for (const reseau of RESEAUX) {
    const variation = cloture.variationsFloat[reseau] ?? 0;
    variationFloats += variation;
    poser(COMPTE_FLOAT, variation, NOM_RESEAU[reseau]);
  }
  // Ce que le float a perdu, le tiroir l'a gagné — plus ou moins l'écart compté.
  poser(COMPTES.caisse, -variationFloats + cloture.ecartEspeces);
  if (cloture.ecartEspeces < 0) poser(COMPTES.manquantCaisse, -cloture.ecartEspeces);
  if (cloture.ecartEspeces > 0) poser(COMPTES.excedentCaisse, -cloture.ecartEspeces);

  poser(COMPTE_COMMISSIONS_A_RECEVOIR, cloture.commissions);
  poser(COMPTES.servicesVendus, -cloture.commissions);

  if (lignes.length === 0) return null;
  const ecriture: Ecriture = {
    journal: "CA",
    date: cloture.date,
    piece: cloture.numero,
    libelle: `Clôture du guichet ${cloture.numero}`,
    lignes,
  };
  if (!estEquilibree(ecriture)) throw new Error(`Écriture déséquilibrée sur ${cloture.numero}.`);
  return ecriture;
}

// ------------------------------------------------------- apport d'ouverture

/** Apports et prélèvements de l'exploitant individuel (SYSCOHADA). */
export const COMPTE_EXPLOITANT = { numero: "104", libelle: "Compte de l'exploitant" };

/**
 * Ce que l'ouverture d'une session aurait dû trouver : les soldes laissés
 * par la clôture précédente. Le float relevé chez l'opérateur fait foi ; à
 * défaut, celui que les opérations laissaient. Aucune session avant : rien.
 */
export function ouvertureAttendue(
  precedente: { especesComptees: number; floats: Partial<Record<Reseau, number>> } | null,
): { especes: number; floats: Record<Reseau, number> } {
  return {
    especes: precedente?.especesComptees ?? 0,
    floats: Object.fromEntries(RESEAUX.map((r) => [r, precedente?.floats[r] ?? 0])) as Record<Reseau, number>,
  };
}

/**
 * Écriture d'ouverture : ce qui entre au guichet sans venir d'une opération
 * vient de l'exploitant.
 *
 *   5712 Float (par réseau)   débit    float apporté
 *   571  Caisse               débit    espèces apportées
 *   104  Exploitant           crédit   total apporté
 *
 * Un écart négatif est un PRÉLÈVEMENT : l'exploitant a repris de l'argent
 * entre deux sessions, et le sens s'inverse. Sans cette écriture, le float
 * ne naît jamais en comptabilité et son compte passe négatif dès le
 * premier dépôt client.
 */
export function ecritureApportOuverture(ouverture: {
  numero: string;
  date: string;
  declare: { especes: number; floats: Partial<Record<Reseau, number>> };
  attendu: { especes: number; floats: Partial<Record<Reseau, number>> };
}): Ecriture | null {
  const lignes: LigneEcriture[] = [];
  const poser = (compte: { numero: string; libelle: string }, montant: number, auxiliaire?: string) => {
    if (montant === 0) return;
    lignes.push({
      compte: compte.numero,
      libelleCompte: compte.libelle,
      ...(auxiliaire ? { auxiliaire } : {}),
      debit: montant > 0 ? montant : 0,
      credit: montant < 0 ? -montant : 0,
    });
  };

  let total = 0;
  for (const reseau of RESEAUX) {
    const ecart = (ouverture.declare.floats[reseau] ?? 0) - (ouverture.attendu.floats[reseau] ?? 0);
    total += ecart;
    poser(COMPTE_FLOAT, ecart, NOM_RESEAU[reseau]);
  }
  const ecartEspeces = ouverture.declare.especes - ouverture.attendu.especes;
  total += ecartEspeces;
  poser(COMPTES.caisse, ecartEspeces);
  poser(COMPTE_EXPLOITANT, -total);

  if (lignes.length === 0) return null;
  const ecriture: Ecriture = {
    journal: "CA",
    date: ouverture.date,
    piece: `${ouverture.numero}-O`,
    libelle: `${total >= 0 ? "Apport" : "Prélèvement"} de l'exploitant — ouverture du guichet ${ouverture.numero}`,
    lignes,
  };
  if (!estEquilibree(ecriture)) throw new Error(`Écriture déséquilibrée sur ${ouverture.numero}.`);
  return ecriture;
}
