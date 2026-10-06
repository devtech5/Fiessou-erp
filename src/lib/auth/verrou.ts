/**
 * Verrouillage d'une session laissée sans activité.
 *
 * Un poste de gestion reste ouvert toute la journée dans une boutique, un
 * bureau partagé, un maquis : quiconque passe devant lit les marges, change un
 * prix ou valide une dépense au nom de celui qui s'est absenté. Au bout du
 * délai, l'écran se voile et ne s'ouvre qu'avec le mot de passe. La session,
 * elle, reste ouverte : le travail en cours n'est pas perdu.
 *
 * Deux gardes complémentaires :
 *
 *   · le navigateur compte l'inactivité (souris, clavier, toucher) et voile
 *     l'écran à l'heure dite ;
 *   · le serveur tient la dernière activité signalée et refuse toute page à
 *     une session dont l'activité est trop ancienne — sans quoi recharger la
 *     page, ou rouvrir l'ordinateur deux heures plus tard, effacerait le voile.
 *
 * Ce fichier ne dépend de rien : il est lu par le serveur et par le navigateur.
 */

/** Délai proposé à la création de l'entreprise, en minutes. */
export const DELAI_VERROUILLAGE_DEFAUT = 10;

/** Délais que l'entreprise peut choisir, en minutes. */
export const DELAIS_VERROUILLAGE = [5, 10, 15, 30, 60] as const;

/**
 * Intervalle minimal entre deux signaux de présence envoyés au serveur.
 *
 * Signaler chaque mouvement de souris ferait une requête par pixel ; une par
 * minute suffit à tenir la dernière activité à la minute près.
 */
export const PAS_PRESENCE_MS = 60_000;

/**
 * Tolérance du serveur au-delà du délai, en minutes.
 *
 * Le serveur ne connaît l'activité qu'à la minute près (voir `PAS_PRESENCE_MS`).
 * Sans marge, il pourrait juger la session éteinte une minute avant que le
 * navigateur ne voile l'écran, et renvoyer vers le déverrouillage quelqu'un
 * qui travaillait. Le voile du navigateur, lui, tombe à l'heure exacte et se
 * double d'un verrou explicite côté serveur.
 */
export const MARGE_SERVEUR_MINUTES = 2;

export function delaiValide(minutes: number): boolean {
  return (DELAIS_VERROUILLAGE as readonly number[]).includes(minutes);
}

/**
 * Vrai si la session doit être déverrouillée avant de servir une page.
 *
 * Verrouillée explicitement (l'écran s'est voilé), ou restée sans signe de vie
 * au-delà du délai et de sa marge.
 */
export function sessionVerrouillee(etat: {
  verrouilleeLe: Date | null;
  derniereActivite: Date;
  delaiMinutes: number;
  maintenant: Date;
}): boolean {
  if (etat.verrouilleeLe) return true;
  const limite = (etat.delaiMinutes + MARGE_SERVEUR_MINUTES) * 60_000;
  return etat.maintenant.getTime() - etat.derniereActivite.getTime() > limite;
}

/**
 * Vrai si l'inactivité constatée par le navigateur atteint le délai.
 *
 * Testé AVANT d'enregistrer un geste : un ordinateur sorti de veille reçoit un
 * mouvement de souris avant que la minuterie n'ait repris. Si ce mouvement
 * comptait d'abord comme activité, le voile ne tomberait jamais.
 */
export function inactiviteEcoulee(derniereActiviteMs: number, maintenantMs: number, delaiMinutes: number): boolean {
  return maintenantMs - derniereActiviteMs >= delaiMinutes * 60_000;
}
