/**
 * Montant en toutes lettres, pour un ordre de virement ou un chèque : la banque
 * le compare au montant en chiffres et rejette l'ordre s'ils divergent.
 *
 * Règles de l'orthographe traditionnelle, celle qu'attendent les banques de
 * la place : traits d'union entre dizaines et unités seulement, « et » devant
 * « un » et « onze » (vingt et un, soixante et onze), « quatre-vingts » et
 * « deux cents » au pluriel quand rien ne suit, « mille » invariable.
 */

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

/** 0 à 99. */
function deuxChiffres(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  let u = n % 10;
  // 70-79 et 90-99 se construisent sur 60 et 80 : soixante-douze, quatre-vingt-quinze.
  if (d === 7 || d === 9) u += 10;
  const base = DIZAINES[d];
  if (u === 0) return d === 8 ? "quatre-vingts" : base;
  if ((u === 1 || u === 11) && d !== 8 && d !== 9) return `${base} et ${UNITES[u]}`;
  return `${base}-${UNITES[u]}`;
}

/** 0 à 999. `final` : le groupe termine le nombre, « cents » et « quatre-vingts » prennent l's. */
function troisChiffres(n: number, final: boolean): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  let texte = reste ? deuxChiffres(reste) : "";
  if (!final && texte.endsWith("quatre-vingts")) texte = texte.slice(0, -1);
  if (c === 0) return texte;
  const cent = c === 1 ? "cent" : `${UNITES[c]} cent${reste === 0 && final ? "s" : ""}`;
  return reste ? `${cent} ${texte}` : cent;
}

/** Un entier positif ou nul en toutes lettres : 1 250 000 → « un million deux cent cinquante mille ». */
export function nombreEnLettres(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("Entier positif attendu.");
  if (n === 0) return "zéro";

  const groupes: [number, string, string][] = [
    [1_000_000_000, "milliard", "milliards"],
    [1_000_000, "million", "millions"],
  ];
  const parties: string[] = [];
  let reste = n;
  for (const [valeur, singulier, pluriel] of groupes) {
    const q = Math.floor(reste / valeur);
    if (q > 0) {
      // Million et milliard sont des noms : « deux cents millions », l'accord tient.
      parties.push(`${nombreEnLettres(q)} ${q > 1 ? pluriel : singulier}`);
      reste %= valeur;
    }
  }
  const milliers = Math.floor(reste / 1000);
  if (milliers > 0) {
    parties.push(milliers === 1 ? "mille" : `${troisChiffres(milliers, false)} mille`);
    reste %= 1000;
  }
  if (reste > 0) parties.push(troisChiffres(reste, true));
  return parties.join(" ");
}

/** « Deux cent cinquante mille francs CFA ». */
export function montantEnLettres(montant: number, devise = "francs CFA"): string {
  const texte = nombreEnLettres(montant);
  return `${texte.charAt(0).toUpperCase()}${texte.slice(1)} ${devise}`;
}
