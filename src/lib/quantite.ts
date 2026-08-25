/**
 * Quantités.
 *
 * Même principe que l'argent : une quantité est un ENTIER, exprimé dans une
 * sous-unité fixe. Là où les montants comptent en francs, les quantités
 * comptent en **millièmes d'unité de vente**.
 *
 *   1,340 kg  ->  1340
 *   2 pièces  ->  2000
 *   0,5 L     ->  500
 *
 * Pourquoi pas un nombre à virgule : en JavaScript, 0,1 + 0,2 ne fait pas 0,3.
 * Sur un montant isolé la dérive passe inaperçue ; sur un stock qui accumule
 * des milliers de mouvements, elle finit par produire un inventaire faux que
 * personne ne sait expliquer.
 *
 * Trois décimales couvrent tout le commerce de détail : le gramme, le
 * millilitre, le millimètre. Au-delà, on ne pèse plus, on dose.
 */

export const ECHELLE_QUANTITE = 1000;

export type CodeUnite =
  | "piece"
  | "kg"
  | "g"
  | "l"
  | "ml"
  | "m"
  | "m2"
  | "m3"
  | "heure"
  | "jour";

export interface Unite {
  code: CodeUnite;
  libelle: string;
  abrege: string;
  /**
   * L'article se vend-il en fraction ?
   *
   * Un poisson se vend au poids, une bouteille non. Le distinguer évite qu'une
   * caisse accepte « 0,4 bouteille » — et permet, à l'inverse, de proposer la
   * saisie au poids là où elle a un sens.
   */
  fractionnable: boolean;
  /** Pas de saisie, en millièmes. 1000 = l'unité entière. */
  pas: number;
}

export const UNITES: Record<CodeUnite, Unite> = {
  piece: { code: "piece", libelle: "Pièce", abrege: "u", fractionnable: false, pas: 1000 },
  kg: { code: "kg", libelle: "Kilogramme", abrege: "kg", fractionnable: true, pas: 10 },
  g: { code: "g", libelle: "Gramme", abrege: "g", fractionnable: false, pas: 1000 },
  l: { code: "l", libelle: "Litre", abrege: "L", fractionnable: true, pas: 50 },
  ml: { code: "ml", libelle: "Millilitre", abrege: "ml", fractionnable: false, pas: 1000 },
  m: { code: "m", libelle: "Mètre", abrege: "m", fractionnable: true, pas: 10 },
  m2: { code: "m2", libelle: "Mètre carré", abrege: "m²", fractionnable: true, pas: 10 },
  m3: { code: "m3", libelle: "Mètre cube", abrege: "m³", fractionnable: true, pas: 10 },
  heure: { code: "heure", libelle: "Heure", abrege: "h", fractionnable: true, pas: 250 },
  jour: { code: "jour", libelle: "Jour", abrege: "j", fractionnable: false, pas: 1000 },
};

/** Convertit une saisie humaine en quantité interne. `1.34` -> `1340`. */
export function versQuantite(valeur: number): number {
  return Math.round(valeur * ECHELLE_QUANTITE);
}

/** Convertit une quantité interne en valeur affichable. `1340` -> `1.34`. */
export function depuisQuantite(quantite: number): number {
  return quantite / ECHELLE_QUANTITE;
}

/**
 * Montant d'une ligne : prix unitaire × quantité, arrondi au franc.
 *
 * C'est le seul endroit où une quantité fractionnaire rencontre un prix, et
 * donc le seul où un arrondi est nécessaire. Le résultat est toujours un
 * entier : il n'existe pas de demi-franc.
 *
 * L'arrondi porte sur le montant, jamais sur la quantité — arrondir 1,340 kg à
 * 1 kg changerait ce que le client emporte.
 *
 * Bornes : un prix unitaire jusqu'au milliard multiplié par une quantité
 * jusqu'au million reste sous 2^53, où l'arithmétique entière est exacte.
 */
export function montantLigne(prixUnitaire: number, quantite: number): number {
  return Math.round((prixUnitaire * quantite) / ECHELLE_QUANTITE);
}

/**
 * Prix unitaire déduit d'un montant et d'une quantité.
 * Utile à la réception : on connaît le total payé et le poids reçu.
 */
export function prixUnitaireDeduit(montant: number, quantite: number): number {
  if (quantite === 0) return 0;
  return Math.round((montant * ECHELLE_QUANTITE) / quantite);
}

const formateurs = new Map<number, Intl.NumberFormat>();

function formateur(decimales: number): Intl.NumberFormat {
  let f = formateurs.get(decimales);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimales,
    });
    formateurs.set(decimales, f);
  }
  return f;
}

/**
 * Affiche une quantité avec son unité.
 *
 * Les décimales ne sont montrées que si elles existent : « 2 u » et non
 * « 2,000 u ». Un caissier qui lit trois zéros inutiles sur chaque ligne finit
 * par ne plus lire la colonne.
 */
export function formaterQuantite(
  quantite: number,
  unite: CodeUnite = "piece",
  avecUnite = true,
): string {
  const info = UNITES[unite];
  const decimales = info.fractionnable ? 3 : 0;
  const texte = formateur(decimales).format(depuisQuantite(quantite));
  return avecUnite ? `${texte} ${info.abrege}` : texte;
}

/**
 * Ajuste une quantité au pas de son unité.
 *
 * Une balance donne le gramme, mais personne ne saisit 1,337 kg à la main : le
 * pas de 10 g cale la saisie sur des valeurs réelles sans interdire la pesée.
 */
export function ajusterAuPas(quantite: number, unite: CodeUnite): number {
  const { pas } = UNITES[unite];
  return Math.max(pas, Math.round(quantite / pas) * pas);
}

/** Une unité non fractionnable refuse toute quantité qui n'est pas entière. */
export function quantiteValide(quantite: number, unite: CodeUnite): boolean {
  if (quantite <= 0) return false;
  if (UNITES[unite].fractionnable) return true;
  return quantite % ECHELLE_QUANTITE === 0;
}
