/**
 * Marchés : règles pures, sans dépendance — testées sans base, lues par le
 * navigateur.
 */

/**
 * Dossier administratif type d'une soumission en Côte d'Ivoire. Proposé à la
 * création, modifiable : un bailleur demande souvent d'autres pièces, un
 * marché privé moins.
 */
export const PIECES_DOSSIER_DEFAUT = [
  "Lettre de soumission signée",
  "Attestation de régularité fiscale (DGI)",
  "Attestation de mise à jour CNPS",
  "Registre du commerce (RCCM)",
  "Déclaration fiscale d'existence (DFE)",
  "Caution de soumission",
  "Offre technique",
  "Offre financière (bordereau des prix, devis quantitatif)",
  "Références de marchés similaires",
  "Attestation de non-faillite",
] as const;

export const STATUTS_SOUMISSION = {
  veille: "En veille",
  en_preparation: "En préparation",
  deposee: "Déposée",
  gagnee: "Gagnée",
  perdue: "Perdue",
  abandonnee: "Abandonnée",
} as const;

export type StatutSoumission = keyof typeof STATUTS_SOUMISSION;

export const TYPES_MARCHE = { public: "Marché public", prive: "Marché privé", bailleur: "Bailleur de fonds" } as const;

/** Une soumission ne revient pas en arrière, et un résultat est définitif. */
export const SUITES_SOUMISSION: Record<StatutSoumission, StatutSoumission[]> = {
  veille: ["en_preparation", "abandonnee"],
  en_preparation: ["deposee", "abandonnee"],
  deposee: ["gagnee", "perdue"],
  gagnee: [],
  perdue: [],
  abandonnee: [],
};

/** Jours restants avant une date-heure limite, arrondis vers le bas ; négatif si passée. */
export function joursRestants(limite: Date, maintenant: Date): number {
  return Math.floor((limite.getTime() - maintenant.getTime()) / 86_400_000);
}

/**
 * Une soumission en cours est en danger quand la date limite approche (sept
 * jours) et que des pièces manquent encore au dossier.
 */
export function soumissionEnDanger(s: { statut: StatutSoumission; dateLimite: Date | null; manquantes: number }, maintenant: Date): boolean {
  if (s.statut !== "veille" && s.statut !== "en_preparation") return false;
  if (!s.dateLimite) return false;
  const j = joursRestants(s.dateLimite, maintenant);
  return j <= 7 && (s.manquantes > 0 || j < 0);
}

// ---------------------------------------------------------- consultations

export interface OffreANoter {
  id: string;
  montant: number | null;
  noteTechnique: number | null;
}

/**
 * Note globale d'une offre sur 100, entière.
 *
 * Le prix se note par rapport à l'offre la moins chère (100 pour elle,
 * proportionnellement moins pour les autres) ; la technique telle que notée.
 * Le poids du prix est celui annoncé aux candidats. Une offre sans montant
 * n'est pas notée : on ne compare pas ce qui n'a pas été proposé.
 */
export function noterOffres(offres: readonly OffreANoter[], poidsPrixBp: number): Map<string, number> {
  const chiffrees = offres.filter((o) => o.montant !== null && o.montant > 0);
  const notes = new Map<string, number>();
  if (chiffrees.length === 0) return notes;
  const moinsChere = Math.min(...chiffrees.map((o) => o.montant!));
  for (const o of chiffrees) {
    const notePrix = Math.round((moinsChere * 100) / o.montant!);
    const technique = o.noteTechnique ?? 0;
    notes.set(o.id, Math.round((notePrix * poidsPrixBp + technique * (10_000 - poidsPrixBp)) / 10_000));
  }
  return notes;
}

// ------------------------------------------------------------- conventions

export type EtatConvention = "a_venir" | "en_vigueur" | "a_renouveler" | "expiree" | "resiliee";

export const ETATS_CONVENTION: Record<EtatConvention, string> = {
  a_venir: "À venir",
  en_vigueur: "En vigueur",
  a_renouveler: "À renouveler",
  expiree: "Expirée",
  resiliee: "Résiliée",
};

function jours(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

/** Ajoute des mois à une date ISO, en restant dans le mois (31 janvier + 1 mois = 28/29 février). */
export function ajouterMois(iso: string, mois: number): string {
  const [a, m, j] = iso.split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + mois, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible.toISOString().slice(0, 10);
}

/**
 * Fin effective : la plus tardive des fins d'avenant, sinon la fin d'origine.
 * Une convention à reconduction tacite dont la fin est passée court d'année
 * en année : sa fin effective est la prochaine échéance annuelle.
 */
export function finEffective(c: { debut: string; fin: string | null; reconductionTacite: boolean }, finsAvenants: readonly (string | null)[], aujourdhui: string): string | null {
  const candidates = [c.fin, ...finsAvenants].filter((f): f is string => Boolean(f)).sort();
  let fin = candidates.at(-1) ?? null;
  if (fin && c.reconductionTacite) {
    let garde = 0;
    while (fin < aujourdhui && garde++ < 100) fin = ajouterMois(fin, 12);
  }
  return fin;
}

export function etatConvention(
  c: { debut: string; fin: string | null; reconductionTacite: boolean; preavisJours: number; resilieeLe: string | null },
  finsAvenants: readonly (string | null)[],
  aujourdhui: string,
): { etat: EtatConvention; fin: string | null; jours: number | null } {
  const fin = finEffective(c, finsAvenants, aujourdhui);
  if (c.resilieeLe && c.resilieeLe <= aujourdhui) return { etat: "resiliee", fin, jours: null };
  if (c.debut > aujourdhui) return { etat: "a_venir", fin, jours: jours(aujourdhui, c.debut) };
  if (!fin) return { etat: "en_vigueur", fin, jours: null };
  const restant = jours(aujourdhui, fin);
  if (restant < 0) return { etat: "expiree", fin, jours: restant };
  if (restant <= c.preavisJours) return { etat: "a_renouveler", fin, jours: restant };
  return { etat: "en_vigueur", fin, jours: restant };
}
