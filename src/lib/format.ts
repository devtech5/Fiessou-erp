const nombre = new Intl.NumberFormat("fr-FR");

/**
 * Affichage compact d'un montant, sans devise : « 2 900 ».
 * Le suffixe FCFA est porté par l'en-tête de colonne ou le libellé voisin,
 * jamais répété sur chaque ligne d'un tableau.
 */
export const fmt = (montant: number) => nombre.format(montant);

/**
 * Montant avec sa devise, pour un total isolé ou une valeur mise en avant.
 */
export const fmtDevise = (montant: number, devise = "FCFA") =>
  `${nombre.format(montant)} ${devise}`;

/**
 * Abrège les grands montants pour les indicateurs de tête, où la précision
 * au franc près n'apporte rien : « 48,8 M » plutôt que « 48 750 450 ».
 */
export function fmtCompact(montant: number): string {
  const absolu = Math.abs(montant);
  if (absolu >= 1_000_000_000) return `${(montant / 1_000_000_000).toFixed(1).replace(".", ",")} Md`;
  if (absolu >= 1_000_000) return `${(montant / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (absolu >= 10_000) return `${Math.round(montant / 1000)} k`;
  return nombre.format(montant);
}

export const fmtEntier = (valeur: number) => nombre.format(valeur);
