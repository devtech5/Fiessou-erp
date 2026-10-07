import { divideMoney } from "@/lib/money";

/**
 * Charges de l'entreprise : ce qu'elle dépense, regroupé pour être lu par un
 * gérant et non par un comptable.
 *
 * La source est la comptabilité, classe 6 : chaque module y passe ses
 * écritures (bons de caisse, dépenses, factures fournisseurs, paie, frais
 * bancaires…). Lire les charges ailleurs donnerait une seconde vérité, qui
 * finirait par diverger du compte de résultat.
 *
 * Ce fichier ne dépend de rien : il se teste sans base.
 */

export type FamilleCharge =
  | "marchandises"
  | "fournitures"
  | "energie"
  | "transport"
  | "loyers"
  | "entretien"
  | "assurances"
  | "telecom"
  | "honoraires"
  | "services"
  | "impots"
  | "personnel"
  | "financier"
  | "dotations"
  | "autres";

/**
 * Familles de charges et les comptes SYSCOHADA qu'elles regroupent.
 *
 * Un compte va à la famille dont le préfixe est le plus long : 6052
 * (électricité) part en énergie avant que 605 ne l'emporte en fournitures.
 * L'ordre de la table est celui de l'affichage.
 */
export const FAMILLES_CHARGE: Record<FamilleCharge, { libelle: string; prefixes: readonly string[] }> = {
  marchandises: { libelle: "Achats de marchandises", prefixes: ["601", "6031"] },
  fournitures: { libelle: "Matières et fournitures", prefixes: ["602", "604", "605", "608", "6032", "6033"] },
  energie: { libelle: "Eau, électricité, carburant", prefixes: ["6042", "6051", "6052", "6053"] },
  transport: { libelle: "Transport et déplacements", prefixes: ["61"] },
  loyers: { libelle: "Loyers et locations", prefixes: ["622"] },
  entretien: { libelle: "Entretien et réparations", prefixes: ["624"] },
  assurances: { libelle: "Assurances", prefixes: ["625"] },
  telecom: { libelle: "Téléphone et internet", prefixes: ["628"] },
  honoraires: { libelle: "Honoraires et prestataires", prefixes: ["632", "637"] },
  services: { libelle: "Autres services extérieurs", prefixes: ["62", "63"] },
  impots: { libelle: "Impôts et taxes", prefixes: ["64"] },
  personnel: { libelle: "Salaires et charges sociales", prefixes: ["66"] },
  financier: { libelle: "Frais financiers", prefixes: ["67"] },
  dotations: { libelle: "Amortissements et provisions", prefixes: ["68", "69"] },
  autres: { libelle: "Autres charges", prefixes: ["65", "6"] },
};

export const ORDRE_FAMILLES = Object.keys(FAMILLES_CHARGE) as FamilleCharge[];

export function familleConnue(cle: string): cle is FamilleCharge {
  return cle in FAMILLES_CHARGE;
}

/** Famille d'un compte de charge ; `null` hors de la classe 6. */
export function familleDuCompte(compte: string): FamilleCharge | null {
  if (!compte.startsWith("6")) return null;
  let meilleure: FamilleCharge = "autres";
  let longueur = 0;
  for (const famille of ORDRE_FAMILLES) {
    for (const prefixe of FAMILLES_CHARGE[famille].prefixes) {
      if (compte.startsWith(prefixe) && prefixe.length > longueur) {
        meilleure = famille;
        longueur = prefixe.length;
      }
    }
  }
  return meilleure;
}

// ------------------------------------------------------------------ mois

/** « 2026-10 » : le mois d'une date ISO. */
export const moisDe = (iso: string) => iso.slice(0, 7);

/** Les `n` mois qui finissent par `fin`, du plus ancien au plus récent. */
export function moisGlissants(fin: string, n: number): string[] {
  const [annee, mois] = fin.split("-").map(Number);
  const resultat: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const rang = annee * 12 + (mois - 1) - i;
    resultat.push(`${Math.floor(rang / 12)}-${String((rang % 12) + 1).padStart(2, "0")}`);
  }
  return resultat;
}

export const moisPrecedent = (mois: string) => moisGlissants(mois, 2)[0];

export function moisSuivant(mois: string): string {
  const [annee, m] = mois.split("-").map(Number);
  return m === 12 ? `${annee + 1}-01` : `${annee}-${String(m + 1).padStart(2, "0")}`;
}

const NOM_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « octobre 2026 ». */
export function libelleMois(mois: string): string {
  const [annee, m] = mois.split("-").map(Number);
  return `${NOM_MOIS[m - 1]} ${annee}`;
}

// --------------------------------------------------------------- regroupement

/** Solde d'un compte de charge sur un mois : débit moins crédit. */
export interface MouvementCharge {
  mois: string;
  compte: string;
  montant: number;
}

export interface FamilleSurPeriode {
  famille: FamilleCharge;
  parMois: Record<string, number>;
  total: number;
}

export interface ChargesSurPeriode {
  mois: readonly string[];
  /** Total toutes familles, mois par mois. */
  parMois: Record<string, number>;
  /** Familles mouvementées sur la période, dans l'ordre d'affichage. */
  familles: FamilleSurPeriode[];
  total: number;
}

/**
 * Regroupe les mouvements de classe 6 par famille et par mois.
 *
 * Un mouvement hors de la période ou hors classe 6 est ignoré. Une famille
 * sans aucun mouvement n'apparaît pas : quinze lignes à zéro cachent les trois
 * qui comptent.
 */
export function regrouperCharges(mouvements: readonly MouvementCharge[], mois: readonly string[]): ChargesSurPeriode {
  const dedans = new Set(mois);
  const vide = () => Object.fromEntries(mois.map((m) => [m, 0])) as Record<string, number>;
  const parMois = vide();
  const parFamille = new Map<FamilleCharge, Record<string, number>>();

  for (const m of mouvements) {
    if (!dedans.has(m.mois)) continue;
    const famille = familleDuCompte(m.compte);
    if (!famille) continue;
    if (!parFamille.has(famille)) parFamille.set(famille, vide());
    parFamille.get(famille)![m.mois] += m.montant;
    parMois[m.mois] += m.montant;
  }

  const familles = ORDRE_FAMILLES.filter((f) => parFamille.has(f)).map((famille) => {
    const montants = parFamille.get(famille)!;
    return { famille, parMois: montants, total: Object.values(montants).reduce((s, v) => s + v, 0) };
  });

  return { mois, parMois, familles, total: Object.values(parMois).reduce((s, v) => s + v, 0) };
}

/** Moyenne mensuelle, en francs entiers. */
export function moyenneMensuelle(montants: readonly number[]): number {
  return divideMoney(
    montants.reduce((s, v) => s + v, 0),
    montants.length,
  );
}

/**
 * Évolution d'un mois sur l'autre, en points de base : 1250 = +12,5 %.
 * `null` quand le mois précédent est nul — une hausse depuis zéro n'a pas de
 * pourcentage.
 */
export function evolutionBp(actuel: number, precedent: number): number | null {
  if (precedent <= 0) return null;
  return divideMoney((actuel - precedent) * 10_000, precedent);
}

// ------------------------------------------------------------------- budget

export type EtatBudget = "sans_budget" | "dans_le_budget" | "proche" | "depasse";

/** Au-delà de 90 % de l'enveloppe, le budget est jugé proche de sa limite. */
export const SEUIL_PROCHE_BP = 9_000;

/** Consommation d'une enveloppe mensuelle, en points de base de celle-ci. */
export function consommationBudget(reel: number, budget: number | null): { bp: number | null; etat: EtatBudget } {
  if (budget === null || budget <= 0) return { bp: null, etat: "sans_budget" };
  const bp = divideMoney(reel * 10_000, budget);
  return { bp, etat: reel > budget ? "depasse" : bp >= SEUIL_PROCHE_BP ? "proche" : "dans_le_budget" };
}

// ------------------------------------------------------ charges récurrentes

export type Periodicite = "mensuelle" | "trimestrielle" | "annuelle";

export const PERIODICITES: Record<Periodicite, { libelle: string; mois: number }> = {
  mensuelle: { libelle: "Chaque mois", mois: 1 },
  trimestrielle: { libelle: "Chaque trimestre", mois: 3 },
  annuelle: { libelle: "Chaque année", mois: 12 },
};

export interface Echeance {
  /** Mois de l'échéance : « 2026-10 ». Une charge n'a qu'une échéance par mois. */
  periode: string;
  date: string;
}

const dernierJour = (annee: number, mois: number) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();

/**
 * Échéances d'une charge récurrente, de la première jusqu'à `jusquA` inclus.
 *
 * Le jour de la première échéance est gardé d'un mois à l'autre, et ramené au
 * dernier jour d'un mois trop court : un loyer dû le 31 tombe le 28 ou le 29
 * février, puis revient au 31 mars.
 */
export function echeancesCharge(charge: { premiereEcheance: string; periodicite: Periodicite }, jusquA: string): Echeance[] {
  const [annee, mois, jour] = charge.premiereEcheance.split("-").map(Number);
  const pas = PERIODICITES[charge.periodicite].mois;
  const resultat: Echeance[] = [];
  for (let i = 0; ; i++) {
    const rang = annee * 12 + (mois - 1) + i * pas;
    const a = Math.floor(rang / 12);
    const m = (rang % 12) + 1;
    const date = `${a}-${String(m).padStart(2, "0")}-${String(Math.min(jour, dernierJour(a, m))).padStart(2, "0")}`;
    if (date > jusquA) return resultat;
    resultat.push({ periode: date.slice(0, 7), date });
  }
}

/**
 * Échéances qui attendent encore leur dépense, jusqu'à `jusquA`.
 *
 * Une échéance déjà préparée — ou volontairement ignorée — n'y figure plus.
 * Celles d'avant `aujourdhui` restent : un loyer oublié est en retard, il n'a
 * pas disparu.
 */
export function echeancesEnAttente(
  charge: { premiereEcheance: string; periodicite: Periodicite },
  traitees: ReadonlySet<string>,
  jusquA: string,
): Echeance[] {
  return echeancesCharge(charge, jusquA).filter((e) => !traitees.has(e.periode));
}

/** Prochaine échéance à traiter, en retard comprise ; `null` s'il n'y en a pas avant un an. */
export function prochaineEcheance(
  charge: { premiereEcheance: string; periodicite: Periodicite },
  traitees: ReadonlySet<string>,
  aujourdhui: string,
): Echeance | null {
  const dansUnAn = `${Number(aujourdhui.slice(0, 4)) + 1}${aujourdhui.slice(4)}`;
  return echeancesEnAttente(charge, traitees, dansUnAn)[0] ?? null;
}

/**
 * Coût mensuel d'une charge récurrente : ce qu'elle pèse sur un mois moyen.
 * Une assurance annuelle de 120 000 F pèse 10 000 F par mois.
 */
export function equivalentMensuel(montant: number, periodicite: Periodicite): number {
  return divideMoney(montant, PERIODICITES[periodicite].mois);
}
