import "server-only";

import { env } from "@/env";

import { deposerLocal, lireLocal, supprimerLocal, urlSigneeLocale } from "./local";

/**
 * Dépôt de fichiers — une interface, un adaptateur derrière.
 *
 * Le reste de l'application ne connaît QUE ce module. C'est le même dispositif
 * que `src/lib/auth/canaux/` pour l'envoi des codes : le jour où le stockage
 * change d'hébergeur (un stockage objet compatible S3, par exemple), il y a un
 * fichier à écrire, pas un module à reprendre.
 *
 * Aujourd'hui un seul adaptateur : le disque (`./local`), sur un volume
 * persistant et sauvegardé. Aucun SDK d'hébergeur : la plateforme ne dépend
 * que de PostgreSQL et du système de fichiers.
 *
 * Rien ici n'est accessible depuis le navigateur : les URL se signent avec
 * `AUTH_SECRET`. D'où `server-only` en tête.
 */

export interface FichierADeposer {
  /** Clé dans le dépôt. Toujours préfixée par l'entreprise — voir `cheminDe`. */
  chemin: string;
  contenu: ArrayBuffer;
  typeMime: string;
}

export type ResultatDepot =
  | { ok: true; chemin: string }
  | { ok: false; raison: string };

/**
 * Clé d'un fichier dans le dépôt.
 *
 * L'identifiant de l'entreprise vient EN TÊTE, et pas en suffixe : c'est ce
 * qui permet d'isoler les fichiers par préfixe, exactement comme
 * `organization_id` isole les lignes. Un chemin qui mêle les entreprises ne se
 * rattrape pas après coup.
 *
 * L'identifiant du document sert de nom : deux fichiers homonymes déposés le
 * même jour ne s'écrasent pas, et le nom d'origine reste en base pour
 * l'affichage.
 */
export function cheminDe(
  organizationId: string,
  documentId: string,
  extension: string,
): string {
  const propre = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return propre
    ? `${organizationId}/${documentId}.${propre}`
    : `${organizationId}/${documentId}`;
}

/**
 * Le dépôt est-il configuré ?
 *
 * Renvoie faux tant que `STOCKAGE_LOCAL` manque. Les écrans restent alors
 * utilisables — la bibliothèque se lit, les échéances s'affichent — et seul
 * l'ajout de fichier refuse, en disant pourquoi. Une variable oubliée ne doit
 * pas fermer un module entier.
 *
 * Dépôt sur disque : le développement (`pnpm dev:local`), et le VPS, où le
 * dossier vit sur un volume persistant que la sauvegarde emporte. Jamais sur
 * un hébergeur à disque éphémère : le redéploiement l'effacerait.
 */
export function stockageConfigure(): boolean {
  return Boolean(env.STOCKAGE_LOCAL);
}

const RAISON_NON_CONFIGURE =
  "Le dépôt de fichiers n'est pas configuré : renseignez STOCKAGE_LOCAL " +
  "(dossier sur un volume persistant et sauvegardé).";

export async function deposer(fichier: FichierADeposer): Promise<ResultatDepot> {
  if (!stockageConfigure()) return { ok: false, raison: RAISON_NON_CONFIGURE };
  return deposerLocal(fichier);
}

/**
 * URL de lecture, valable un temps limité.
 *
 * Aucun lien direct ne fonctionne, et c'est voulu. Une pièce d'identité, un
 * contrat de travail ou un bulletin de paie lisibles par quiconque devine
 * l'adresse, c'est exactement ce que ce module doit empêcher. L'URL se signe
 * au moment où l'écran s'ouvre, et expire toute seule.
 */
export async function urlSignee(
  chemin: string,
  secondes = 300,
): Promise<string | null> {
  if (!stockageConfigure()) return null;
  return urlSigneeLocale(chemin, secondes);
}

/**
 * Relit un fichier côté serveur, pour en recalculer l'empreinte.
 *
 * Jamais pour le servir au navigateur : celui-ci passe par une URL signée.
 * Rend `null` si le fichier est absent ou le dépôt muet.
 */
export async function lireFichier(chemin: string): Promise<Uint8Array | null> {
  if (!stockageConfigure()) return null;
  return lireLocal(chemin);
}

/**
 * Retire un fichier du dépôt.
 *
 * Appelée quand la ligne en base est supprimée, jamais l'inverse : un fichier
 * orphelin coûte un peu d'espace, une ligne qui pointe vers un fichier disparu
 * casse l'écran.
 */
export async function supprimer(chemin: string): Promise<boolean> {
  if (!stockageConfigure()) return false;
  return supprimerLocal(chemin);
}
