/**
 * Manipulation des montants.
 *
 * Règle unique : un montant est un ENTIER, dans la plus petite unité de sa
 * devise. Jamais un flottant, à aucun moment, y compris dans les moyennes et
 * les totaux intermédiaires.
 *
 * Le franc CFA n'a pas de subdivision : 2 900 XOF se stocke `2900`.
 * Le concurrent affiche « 2 990,841 FCFA » comme ticket moyen faute d'avoir
 * arrondi une division. C'est exactement ce que ce module empêche.
 */

/** Nombre de décimales par devise (ISO 4217). */
const EXPONENTS: Record<string, number> = {
  XOF: 0, // franc CFA — UEMOA
  XAF: 0, // franc CFA — CEMAC
  GNF: 0,
  EUR: 2,
  USD: 2,
};

export function exponentOf(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

/**
 * Formate un montant pour l'affichage.
 * @example formatMoney(2900, "XOF") → "2 900 F CFA"
 */
export function formatMoney(
  amount: number,
  currency = "XOF",
  locale = "fr-CI",
): string {
  const exponent = exponentOf(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amount / 10 ** exponent);
}

/**
 * Divise un montant en renvoyant un entier.
 *
 * À utiliser pour tout ratio monétaire — ticket moyen, prix unitaire moyen,
 * panier moyen. Le reste est perdu volontairement : il n'existe pas de demi-franc.
 */
export function divideMoney(total: number, count: number): number {
  if (count === 0) return 0;
  return Math.round(total / count);
}

/**
 * Applique un pourcentage à un montant et renvoie un entier.
 * @example percentOf(1275, 18) → 230
 */
export function percentOf(amount: number, rate: number): number {
  return Math.round((amount * rate) / 100);
}

/**
 * Répartit un montant en `parts` portions entières dont la somme est exacte.
 *
 * Indispensable pour ventiler une remise globale sur des lignes, ou une TVA
 * sur plusieurs taux : additionner des arrondis indépendants ne retombe jamais
 * sur le total. Le reste est distribué sur les premières portions.
 *
 * @example allocate(100, 3) → [34, 33, 33]
 */
export function allocate(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(amount / parts);
  const remainder = amount - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Répartit un montant proportionnellement à des poids, en gardant la somme exacte.
 * Utilisé pour ventiler une remise de pied de ticket sur les lignes.
 */
export function allocateByWeights(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return weights.map(() => 0);

  const shares = weights.map((w) => Math.floor((amount * w) / total));
  let remainder = amount - shares.reduce((sum, s) => sum + s, 0);

  // Le reliquat va aux lignes dont la part décimale était la plus forte.
  const order = weights
    .map((w, i) => ({ i, frac: (amount * w) % total }))
    .sort((a, b) => b.frac - a.frac);

  for (const { i } of order) {
    if (remainder <= 0) break;
    shares[i] += 1;
    remainder -= 1;
  }
  return shares;
}

/**
 * Applique un taux exprimé en POINTS DE BASE : 1800 = 18 %, 925 = 9,25 %.
 *
 * `percentOf` suffit tant que le taux est un entier de pourcentage. Il ne
 * suffit plus dès qu'un taux porte des décimales — et il en existe : taxes
 * spécifiques, prélèvements sectoriels, taux réduits négociés. Les stocker en
 * points de base garde l'entier partout, du schéma jusqu'au calcul.
 *
 * @example rateOf(1275, 1800) → 230
 */
export function rateOf(amount: number, rateBp: number): number {
  return Math.round((amount * rateBp) / 10_000);
}
