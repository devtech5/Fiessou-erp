import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { lireSession, type SessionActive } from "./session";

/**
 * Couche d'accès : c'est ICI que se vérifie l'authentification, pas ailleurs.
 *
 * Le fichier `proxy.ts` se contente d'une vérification optimiste sur la
 * présence du cookie, parce qu'il s'exécute sur chaque route, préchargements
 * compris, et qu'y placer une requête base coûterait à chaque navigation.
 * Un cookie présent ne prouve rien : il peut porter un jeton révoqué, expiré
 * ou inventé. La seule vérification qui engage quelque chose est celle-ci.
 *
 * `cache` de React déduplique l'appel pour la durée d'un rendu : une page qui
 * vérifie la session dans son layout, sa page et trois composants ne fait
 * qu'une requête.
 */
export const session = cache(lireSession);

/**
 * Exige une session. Redirige vers la connexion sinon.
 *
 * À appeler dans tout layout, page ou action qui touche des données d'entreprise.
 */
export async function exigerSession(): Promise<SessionActive> {
  const active = await session();
  if (!active) redirect("/connexion");
  // Un mot de passe provisoire est connu de celui qui l'a donné : tant qu'il
  // n'est pas remplacé, le compte n'ouvre que l'écran de changement.
  if (active.doitChangerMotDePasse) redirect("/mot-de-passe");
  return active;
}

/**
 * Exige une session ET une entreprise active.
 *
 * Un utilisateur authentifié sans entreprise choisie n'est pas une anomalie :
 * c'est l'état juste après inscription, ou quand il appartient à plusieurs
 * entreprises et n'en a pas encore sélectionné une.
 */
export async function exigerEntreprise(): Promise<
  SessionActive & { organizationId: string }
> {
  const active = await exigerSession();
  if (!active.organizationId) redirect("/entreprises");
  return active as SessionActive & { organizationId: string };
}
