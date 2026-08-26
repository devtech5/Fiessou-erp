import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { rolePermissions } from "@/db/schema";
import { exigerEntreprise } from "@/lib/auth/dal";
import type { SessionActive } from "@/lib/auth/session";
import { type Droit, definitionDroit, presetRole, resoudreDroits } from "./catalogue";

export type SessionEntreprise = SessionActive & { organizationId: string };

/**
 * Garde des droits.
 *
 * Une règle, toujours la même : **l'écran cache, l'action refuse.** Masquer un
 * bouton n'est pas une protection — une action serveur est une route HTTP, et
 * quiconque tient une session peut l'appeler à la main. Toute écriture vérifie
 * donc son droit chez elle, indépendamment de ce que l'interface a bien voulu
 * afficher.
 *
 * Trois formes selon l'appelant :
 *
 *   · `peut`        — booléen, pour décider d'afficher (barre latérale, boutons)
 *   · `refusDroit`  — message d'erreur, pour une action à état de formulaire
 *   · `exigerDroit` — lève, pour une action sans état : l'appel n'aurait pas dû
 *                     partir, il n'y a pas d'interface pour en rendre compte.
 */

/**
 * Droits effectifs de la session courante, dédupliqués pour la durée du rendu.
 *
 * Un rôle préréglé ne coûte aucune requête : ses droits sont dans le code. Seul
 * un rôle créé par l'entreprise fait descendre dans `role_permissions`.
 */
export const droitsActifs = cache(async (): Promise<Set<Droit>> => {
  const session = await exigerEntreprise();

  if (session.estProprietaire || presetRole(session.roleCle)) {
    return resoudreDroits({
      cleRole: session.roleCle,
      estProprietaire: session.estProprietaire,
    });
  }

  const accords = session.roleId
    ? await db
        .select({ cle: rolePermissions.permissionKey })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, session.roleId))
    : [];

  return resoudreDroits({
    cleRole: session.roleCle,
    estProprietaire: false,
    accords: accords.map((a) => a.cle),
  });
});

/** Vrai si la session courante détient ce droit. */
export async function peut(droit: Droit): Promise<boolean> {
  return (await droitsActifs()).has(droit);
}

/**
 * Exige un droit et rend la session. Lève si le droit manque.
 *
 * Pour les actions qui ne rendent pas d'état : un appel non autorisé y est soit
 * un bogue d'interface, soit une tentative. Dans les deux cas il n'y a rien à
 * afficher de mieux qu'une erreur.
 */
export async function exigerDroit(droit: Droit): Promise<SessionEntreprise> {
  const session = await exigerEntreprise();
  if (!(await peut(droit))) throw new Error(messageRefus(droit));
  return session;
}

/**
 * Contrôle un droit pour une action à état de formulaire.
 *
 * Rend l'objet d'erreur prêt à retourner, ou `null` si le droit est là. Le
 * formulaire affiche le refus là où il affiche déjà ses erreurs de saisie,
 * plutôt que de faire éclater une page d'erreur au visage du caissier.
 */
export async function refusDroit(droit: Droit): Promise<{ erreur: string } | null> {
  return (await peut(droit)) ? null : { erreur: messageRefus(droit) };
}

/**
 * Le message nomme le droit manquant, pas seulement le refus.
 *
 * « Vous n'avez pas les droits » n'apprend rien à personne : c'est le gérant
 * qui devra corriger, et il lui faut savoir quoi ouvrir.
 */
export function messageRefus(droit: Droit): string {
  return `Votre rôle ne permet pas cette opération : ${definitionDroit(droit).libelle.toLowerCase()}. Demandez ce droit au responsable de l'entreprise.`;
}
