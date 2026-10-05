import type { AxeVariante } from "./schema";

/**
 * Variantes d'un modèle : combinaisons, références et désignations. Règles
 * pures.
 *
 * La référence d'une variante se lit sur une étiquette de rayon et se tape
 * au clavier : DERBY-42-NOIR, pas un identifiant opaque. Le code de chaque
 * valeur est donc court, sans accent ni espace, et unique dans son axe.
 */

export const AXES_MAX = 3;
export const VALEURS_PAR_AXE_MAX = 40;
export const VARIANTES_MAX = 300;

/** « Bleu marine » → BLEUMA ; « 42 » → 42 ; « XL » → XL. */
export function codeValeur(valeur: string): string {
  const propre = valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  if (/^[0-9 ]+$/.test(propre)) return propre.replace(/ /g, "").slice(0, 8);
  const mots = propre.split(" ").filter(Boolean);
  if (mots.length === 1) return mots[0].slice(0, 6);
  // Plusieurs mots : le premier en entier (court) puis les initiales.
  return (mots[0].slice(0, 4) + mots.slice(1).map((m) => m.slice(0, 2)).join("")).slice(0, 8);
}

/** Axes nettoyés : noms et valeurs sans blancs superflus, valeurs vides retirées. */
export function nettoyerAxes(axes: readonly AxeVariante[]): AxeVariante[] {
  return axes
    .map((a) => ({ nom: a.nom.trim(), valeurs: a.valeurs.map((v) => v.trim()).filter(Boolean) }))
    .filter((a) => a.nom || a.valeurs.length);
}

export function nombreDeVariantes(axes: readonly AxeVariante[]): number {
  return axes.reduce((n, a) => n * a.valeurs.length, axes.length ? 1 : 0);
}

export function refusAxes(axes: readonly AxeVariante[]): string | null {
  if (axes.length === 0) return "Un modèle se décline sur au moins un axe : taille, couleur, pointure…";
  if (axes.length > AXES_MAX) return `${AXES_MAX} axes au plus.`;
  const noms = new Set<string>();
  for (const a of axes) {
    if (!a.nom) return "Chaque axe porte un nom.";
    const cle = a.nom.toLowerCase();
    if (noms.has(cle)) return `L'axe « ${a.nom} » apparaît deux fois.`;
    noms.add(cle);
    if (a.valeurs.length === 0) return `L'axe « ${a.nom} » n'a aucune valeur.`;
    if (a.valeurs.length > VALEURS_PAR_AXE_MAX) return `L'axe « ${a.nom} » dépasse ${VALEURS_PAR_AXE_MAX} valeurs.`;
    const vues = new Map<string, string>();
    const codes = new Map<string, string>();
    for (const v of a.valeurs) {
      if (vues.has(v.toLowerCase())) return `« ${v} » apparaît deux fois dans l'axe « ${a.nom} ».`;
      vues.set(v.toLowerCase(), v);
      const code = codeValeur(v);
      if (!code) return `« ${v} » ne donne aucun code lisible.`;
      if (codes.has(code)) return `« ${codes.get(code)} » et « ${v} » donnent le même code (${code}) dans l'axe « ${a.nom} » : distinguez-les davantage.`;
      codes.set(code, v);
    }
  }
  const n = nombreDeVariantes(axes);
  if (n > VARIANTES_MAX) return `${n} combinaisons : c'est plus de ${VARIANTES_MAX}. Scindez le modèle.`;
  return null;
}

/** Produit cartésien des axes, dans l'ordre des axes puis des valeurs. */
export function combinaisons(axes: readonly AxeVariante[]): Record<string, string>[] {
  return axes.reduce<Record<string, string>[]>(
    (acc, axe) => acc.flatMap((c) => axe.valeurs.map((v) => ({ ...c, [axe.nom]: v }))),
    [{}],
  );
}

/** Clé stable d'une combinaison, indépendante de l'ordre des clés. */
export function cleCombinaison(attributs: Record<string, string>, axes: readonly AxeVariante[]): string {
  return axes.map((a) => `${a.nom}=${attributs[a.nom] ?? ""}`).join("|");
}

export function referenceVariante(referenceModele: string, attributs: Record<string, string>, axes: readonly AxeVariante[]): string {
  return [referenceModele, ...axes.map((a) => codeValeur(attributs[a.nom] ?? ""))].join("-");
}

export function designationVariante(designation: string, attributs: Record<string, string>, axes: readonly AxeVariante[]): string {
  return `${designation} — ${axes.map((a) => attributs[a.nom]).join(" · ")}`;
}

/**
 * Ajout de valeurs à un modèle existant : les nouveaux axes sont refusés
 * (toutes les variantes existantes deviendraient incomplètes), les valeurs
 * déjà présentes sont gardées, l'ordre d'origine aussi.
 */
export function fusionnerAxes(existants: readonly AxeVariante[], ajouts: readonly AxeVariante[]): AxeVariante[] {
  return existants.map((a) => {
    const plus = ajouts.find((x) => x.nom.toLowerCase() === a.nom.toLowerCase())?.valeurs ?? [];
    const deja = new Set(a.valeurs.map((v) => v.toLowerCase()));
    return { nom: a.nom, valeurs: [...a.valeurs, ...plus.map((v) => v.trim()).filter((v) => v && !deja.has(v.toLowerCase()))] };
  });
}
