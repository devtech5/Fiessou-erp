/**
 * Règles des tâches, sans base : transitions, retard, tri. Importable depuis
 * le navigateur.
 */

export type Statut = "a_faire" | "en_cours" | "terminee" | "annulee";
export type Priorite = "basse" | "normale" | "haute" | "urgente";
export type Geste = "demarrer" | "terminer" | "rouvrir" | "annuler";

export const LIBELLE_STATUT: Record<Statut, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
};

export const LIBELLE_PRIORITE: Record<Priorite, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
};

const RANG_PRIORITE: Record<Priorite, number> = { urgente: 0, haute: 1, normale: 2, basse: 3 };

/** Statut d'arrivée de chaque geste, et statuts d'où il part. */
const TRANSITIONS: Record<Geste, { depuis: Statut[]; vers: Statut }> = {
  demarrer: { depuis: ["a_faire"], vers: "en_cours" },
  terminer: { depuis: ["a_faire", "en_cours"], vers: "terminee" },
  rouvrir: { depuis: ["terminee", "annulee"], vers: "a_faire" },
  annuler: { depuis: ["a_faire", "en_cours"], vers: "annulee" },
};

export function statutApres(geste: Geste, actuel: Statut): Statut | null {
  const regle = TRANSITIONS[geste];
  return regle.depuis.includes(actuel) ? regle.vers : null;
}

export interface Acteur {
  userId: string;
  /** Porte le droit d'attribuer : il agit sur toutes les tâches. */
  attribue: boolean;
}

export interface Parties {
  creeParUserId: string;
  assigneeUserId: string;
}

/**
 * Qui peut faire quel geste.
 *
 *   · démarrer, terminer — l'exécutant, ou qui attribue ;
 *   · annuler, rouvrir   — le créateur, ou qui attribue : l'exécutant ne se
 *                          débarrasse pas d'une tâche qu'on lui a confiée en
 *                          l'annulant ; il la termine ou il en parle.
 */
export function gestePermis(geste: Geste, tache: Parties, acteur: Acteur): boolean {
  if (acteur.attribue) return true;
  if (geste === "demarrer" || geste === "terminer") return tache.assigneeUserId === acteur.userId;
  return tache.creeParUserId === acteur.userId;
}

/** Gestes proposés pour une tâche, dans l'ordre d'affichage. */
export function gestesPossibles(statut: Statut, tache: Parties, acteur: Acteur): Geste[] {
  return (["demarrer", "terminer", "rouvrir", "annuler"] as const).filter(
    (g) => statutApres(g, statut) !== null && gestePermis(g, tache, acteur),
  );
}

/**
 * Jours avant l'échéance : négatif en retard, nul le jour même, `null` sans
 * échéance ou pour une tâche close. Les dates sont des jours ISO, comparés en
 * UTC : une échéance n'a pas d'heure.
 */
export function joursAvantEcheance(echeance: string | null, statut: Statut, aujourdhui: string): number | null {
  if (!echeance || statut === "terminee" || statut === "annulee") return null;
  const jour = 24 * 3600 * 1000;
  return Math.round((Date.parse(`${echeance}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / jour);
}

export function enRetard(echeance: string | null, statut: Statut, aujourdhui: string): boolean {
  const j = joursAvantEcheance(echeance, statut, aujourdhui);
  return j !== null && j < 0;
}

export interface Triable {
  statut: Statut;
  priorite: Priorite;
  echeance: string | null;
  creeLe: string;
}

/**
 * Ordre de travail : ce qui est ouvert avant ce qui est clos, puis l'échéance
 * la plus proche (sans échéance en dernier), puis la priorité, puis l'ancienneté.
 */
export function comparerTaches(a: Triable, b: Triable): number {
  const close = (t: Triable) => (t.statut === "terminee" || t.statut === "annulee" ? 1 : 0);
  if (close(a) !== close(b)) return close(a) - close(b);
  if (a.echeance !== b.echeance) {
    if (!a.echeance) return 1;
    if (!b.echeance) return -1;
    return a.echeance < b.echeance ? -1 : 1;
  }
  if (a.priorite !== b.priorite) return RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite];
  return a.creeLe < b.creeLe ? -1 : a.creeLe > b.creeLe ? 1 : 0;
}
