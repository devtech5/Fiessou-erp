import { divideMoney } from "@/lib/money";

/**
 * Règles du tableau de bord du commerce, sans base : comparer deux journées,
 * ranger l'affluence par heure.
 */

/**
 * Écart d'une valeur à sa référence, en POINTS DE BASE : 1250 = +12,5 %.
 *
 * Nul quand la référence est nulle : « +∞ % » par rapport à un dimanche fermé
 * n'apprend rien au commerçant, et il ne faut pas le lui afficher.
 */
export function variationBp(actuel: number, reference: number): number | null {
  if (reference <= 0) return null;
  return divideMoney((actuel - reference) * 10_000, reference);
}

/** « +12,5 % », « −3,0 % ». Le signe moins est le vrai, pas un tiret. */
export function libelleVariation(bp: number): string {
  const signe = bp > 0 ? "+" : bp < 0 ? "−" : "";
  const valeur = (Math.abs(bp) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${signe}${valeur} %`;
}

export interface Heure {
  heure: number;
  tickets: number;
  montant: number;
}

/**
 * Les heures d'ouverture effectives, trous compris.
 *
 * De la première à la dernière heure qui a vu un ticket, élargies à 8 h – 20 h :
 * une heure creuse au milieu de la journée doit apparaître comme une barre
 * vide, pas disparaître du graphique — c'est elle que le commerçant cherche
 * quand il se demande s'il peut fermer pour déjeuner.
 */
export function plageAffluence(heures: readonly Heure[]): Heure[] {
  const actives = heures.filter((h) => h.tickets > 0).map((h) => h.heure);
  const debut = Math.min(8, ...actives);
  const fin = Math.max(20, ...actives);
  const parHeure = new Map(heures.map((h) => [h.heure, h]));
  return Array.from({ length: fin - debut + 1 }, (_, i) => {
    const heure = debut + i;
    return parHeure.get(heure) ?? { heure, tickets: 0, montant: 0 };
  });
}

/** L'heure la plus chargée, en tickets. Nulle tant que rien n'est vendu. */
export function heureDePointe(heures: readonly Heure[]): Heure | null {
  return heures.reduce<Heure | null>((max, h) => (h.tickets > 0 && (!max || h.tickets > max.tickets) ? h : max), null);
}

/**
 * Catalogue de départ d'un commerce de détail.
 *
 * Des FAMILLES, pas des articles : les produits d'une supérette de Yopougon ne
 * sont pas ceux d'une quincaillerie de Treichville, mais tous se rangent dans
 * ces rayons. Le taux et les comptes sont ceux du cas général — vente de
 * marchandises, TVA à 18 % — et se corrigent famille par famille : un produit
 * exonéré se règle sur sa fiche, avec le comptable.
 */
export const FAMILLES_COMMERCE = [
  { code: "ALIM", nom: "Alimentation" },
  { code: "BOIS", nom: "Boissons" },
  { code: "HYG", nom: "Hygiène et beauté" },
  { code: "ENTR", nom: "Entretien" },
  { code: "BAZ", nom: "Bazar et maison" },
  { code: "DIV", nom: "Divers" },
] as const;
