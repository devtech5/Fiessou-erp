import "server-only";

import { env } from "@/env";

/**
 * Dépôt de fichiers — une interface, un adaptateur derrière.
 *
 * Le reste de l'application ne connaît QUE ce module. C'est le même dispositif
 * que `src/lib/auth/canaux/` pour l'envoi des codes : le jour où le stockage
 * change d'hébergeur, il y a un fichier à écrire, pas un module à reprendre.
 *
 * La base, elle, reste portable vers n'importe quel PostgreSQL — c'est la
 * position posée dans `.env.example`, et cette frontière est ce qui permet de
 * la tenir malgré l'arrivée d'un SDK d'hébergeur.
 *
 * Rien ici n'est accessible depuis le navigateur : la clé employée contourne
 * RLS sur tout le projet. D'où `server-only` en tête, et aucun préfixe
 * `NEXT_PUBLIC_` sur les variables.
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
 * qui permettra plus tard d'isoler les fichiers par une policy de stockage sur
 * le préfixe, exactement comme `organization_id` isole les lignes. Un chemin
 * qui mêle les entreprises ne se rattrape pas après coup.
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
 * Renvoie faux tant que l'URL du projet ou la clé manquent. Les écrans
 * restent alors utilisables — la bibliothèque se lit, les échéances
 * s'affichent — et seul l'ajout de fichier refuse, en disant pourquoi. Une
 * variable oubliée ne doit pas fermer un module entier.
 */
export function stockageConfigure(): boolean {
  return supabaseConfigure() || localActif();
}

function supabaseConfigure(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Le dépôt sur disque ne sert qu'au développement, jamais en production. */
function localActif(): boolean {
  return Boolean(env.STOCKAGE_LOCAL) && env.NODE_ENV !== "production";
}

const RAISON_NON_CONFIGURE =
  "Le dépôt de fichiers n'est pas configuré : renseignez SUPABASE_URL et " +
  "SUPABASE_SERVICE_ROLE_KEY, et créez le bucket privé.";

export async function deposer(fichier: FichierADeposer): Promise<ResultatDepot> {
  if (!stockageConfigure()) return { ok: false, raison: RAISON_NON_CONFIGURE };
  if (!supabaseConfigure()) return (await import("./local")).deposerLocal(fichier);

  const { deposerSupabase } = await import("./supabase");
  return deposerSupabase(fichier);
}

/**
 * URL de lecture, valable un temps limité.
 *
 * Le bucket est PRIVÉ : aucun lien direct ne fonctionne, et c'est voulu. Une
 * pièce d'identité, un contrat de travail ou un bulletin de paie lisibles par
 * quiconque devine l'adresse, c'est exactement ce que ce module doit empêcher.
 * L'URL se signe au moment où l'écran s'ouvre, et expire toute seule.
 */
export async function urlSignee(
  chemin: string,
  secondes = 300,
): Promise<string | null> {
  if (!stockageConfigure()) return null;
  if (!supabaseConfigure()) return (await import("./local")).urlSigneeLocale(chemin, secondes);

  const { urlSigneeSupabase } = await import("./supabase");
  return urlSigneeSupabase(chemin, secondes);
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
  if (!supabaseConfigure()) return (await import("./local")).supprimerLocal(chemin);

  const { supprimerSupabase } = await import("./supabase");
  return supprimerSupabase(chemin);
}
