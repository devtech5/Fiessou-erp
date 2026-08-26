/**
 * Jugement d'une échéance — logique pure, ni base ni React.
 *
 * Deux déclencheurs qui ne se comparent pas : une date et un seuil de
 * compteur. Une échéance qui porte les deux — « tous les 5 000 km ou six
 * mois » — échoit au PREMIER atteint, jamais au dernier. Prendre le plus
 * lointain reviendrait à laisser rouler un véhicule six mois de plus parce
 * qu'il n'a pas atteint son kilométrage, ce qui est exactement ce que la
 * double condition sert à empêcher.
 */

export type Gravite = "depassee" | "proche" | "a_venir";

/** Au-delà, une échéance calendaire n'appelle pas encore d'action. */
export const SEUIL_JOURS_PROCHE = 30;

/**
 * Marge de compteur en deçà de laquelle il faut s'organiser.
 *
 * Exprimée en pour mille du seuil et non en valeur absolue : 500 km avant une
 * vidange à 5 000 km laisse le temps de prendre rendez-vous, 500 heures avant
 * une révision à 250 heures n'a aucun sens. Un dixième du seuil marche pour
 * les deux.
 */
export const MARGE_COMPTEUR_BP = 1_000;

export interface EcheanceAJuger {
  /** Terme calendaire, date nue ISO. Nul quand l'échéance est au compteur. */
  echeanceLe: string | null;
  /** Seuil de compteur. Nul quand l'échéance est calendaire. */
  compteurCible: number | null;
  /** Dernier relevé connu. Nul quand l'actif n'a pas de compteur. */
  compteurActuel: number | null;
}

export interface Jugement {
  gravite: Gravite;
  /** Jours avant le terme calendaire. Nul quand il n'y en a pas. */
  joursRestants: number | null;
  /** Unités de compteur avant le seuil. Nul quand il n'y en a pas. */
  resteCompteur: number | null;
  /**
   * Clé de tri, du plus urgent au moins urgent. Les deux natures se rangent
   * sur la même échelle en ramenant le compteur à une fraction de sa marge :
   * sans cela, trier mêlerait des jours et des kilomètres.
   */
  rang: number;
}

/**
 * Jours civils avant une date nue.
 *
 * Calcul en UTC sur des dates sans heure : passer par l'heure locale ferait
 * basculer une échéance d'un jour selon le fuseau du navigateur.
 */
export function joursAvant(dateIso: string, aujourdhui: Date): number | null {
  const terme = Date.parse(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(terme)) return null;

  const jour = Date.UTC(
    aujourdhui.getUTCFullYear(),
    aujourdhui.getUTCMonth(),
    aujourdhui.getUTCDate(),
  );

  return Math.round((terme - jour) / 86_400_000);
}

/**
 * Juge une échéance, et ne retient que le déclencheur le plus proche.
 *
 * Une échéance sans déclencheur exploitable — pas de date, ou un seuil de
 * compteur sur un actif dont aucun relevé n'existe — est rendue « à venir »
 * avec un rang très lointain : elle reste visible, sans encombrer la tête de
 * liste avec une urgence qu'on ne sait pas évaluer.
 */
export function jugerEcheance(
  echeance: EcheanceAJuger,
  aujourdhui: Date,
): Jugement {
  const joursRestants = echeance.echeanceLe
    ? joursAvant(echeance.echeanceLe, aujourdhui)
    : null;

  const resteCompteur =
    echeance.compteurCible !== null && echeance.compteurActuel !== null
      ? echeance.compteurCible - echeance.compteurActuel
      : null;

  const rangs: number[] = [];

  if (joursRestants !== null) rangs.push(joursRestants);

  if (resteCompteur !== null && echeance.compteurCible !== null) {
    // Le reste est ramené en « jours équivalents » : la marge du compteur vaut
    // le seuil calendaire, ce qui met les deux natures sur la même échelle.
    const marge = Math.max(
      1,
      Math.round((echeance.compteurCible * MARGE_COMPTEUR_BP) / 10_000),
    );
    rangs.push(Math.round((resteCompteur * SEUIL_JOURS_PROCHE) / marge));
  }

  if (rangs.length === 0) {
    return { gravite: "a_venir", joursRestants, resteCompteur, rang: 99_999 };
  }

  // Le premier déclencheur atteint commande : le minimum, jamais le maximum.
  const rang = Math.min(...rangs);

  const gravite: Gravite =
    rang < 0 ? "depassee" : rang <= SEUIL_JOURS_PROCHE ? "proche" : "a_venir";

  return { gravite, joursRestants, resteCompteur, rang };
}
