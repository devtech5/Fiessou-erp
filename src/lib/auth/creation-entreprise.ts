import "server-only";

import { db } from "@/db";
import { memberships, organizations, roles } from "@/db/schema";
import { PRESETS_ROLES } from "@/lib/droits/catalogue";
import { newId } from "@/lib/ids";

/**
 * Crée une entreprise, ses rôles préréglés et le rattachement du propriétaire,
 * en une seule transaction.
 *
 * Les trois vont ensemble : une entreprise sans propriétaire n'est
 * administrable par personne, et un rattachement sans rôle ne donne aucun
 * droit. Les créer séparément laisserait, au moindre incident, une entreprise
 * orpheline dans la base.
 *
 * Partagé entre l'inscription — où l'entreprise naît avec l'utilisateur — et
 * la création d'une entreprise supplémentaire depuis le sélecteur.
 */
export async function creerEntreprisePour(
  userId: string,
  entreprise: { nom: string; pays: string },
  transaction?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const executer = async (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => {
    const organizationId = newId();

    await tx.insert(organizations).values({
      id: organizationId,
      name: entreprise.nom,
      // Le suffixe évite la collision entre deux « Boutique Chez Awa » sans
      // imposer un nom unique à l'exploitant : deux commerces peuvent
      // légitimement porter la même enseigne.
      slug: `${slug(entreprise.nom)}-${organizationId.slice(0, 8)}`,
      countryCode: entreprise.pays,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const roleId = await semerRolesPresets(tx, organizationId);

    await tx.insert(memberships).values({
      id: newId(),
      organizationId,
      userId,
      roleId,
      status: "actif",
      isOwner: true,
      joinedAt: new Date(),
    });

    return organizationId;
  };

  return transaction ? executer(transaction) : db.transaction(executer);
}

/**
 * Installe dans l'entreprise les rôles que Fiessou fournit, et rend
 * l'identifiant de celui de propriétaire.
 *
 * Les préréglages sont copiés dans chaque entreprise plutôt que partagés :
 * un exploitant doit pouvoir appeler son caissier « guichetier » sans que le
 * mot change chez le voisin. Ce qui reste commun, c'est la clé — et c'est elle
 * qui décide des droits, lus dans `src/lib/droits/catalogue.ts`.
 *
 * D'où `isSystem` : le rôle porte des droits que le code fixe. Il se renomme,
 * il ne se recompose pas. Un exploitant qui veut un autre découpage crée son
 * propre rôle, dont les droits vivent, eux, dans `role_permissions`.
 */
export async function semerRolesPresets(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
): Promise<string> {
  const inseres = await tx
    .insert(roles)
    .values(
      PRESETS_ROLES.map((preset) => ({
        id: newId(),
        organizationId,
        key: preset.cle,
        name: preset.nom,
        description: preset.description,
        isSystem: true,
      })),
    )
    // Une entreprise déjà pourvue ne se fait pas renommer ses rôles : le
    // script de rattrapage passe sur toutes, y compris celles qui les ont.
    .onConflictDoNothing({ target: [roles.organizationId, roles.key] })
    .returning({ id: roles.id, key: roles.key });

  const proprietaire = inseres.find((role) => role.key === "proprietaire");

  // Impossible en création : les rôles viennent d'être posés dans une
  // entreprise qui n'existait pas. Si la ligne manque, c'est que le catalogue
  // a perdu son préréglage de propriétaire — l'entreprise naîtrait sans
  // administrateur, autant ne pas la créer.
  if (!proprietaire) {
    throw new Error("Aucun rôle « proprietaire » au catalogue des préréglages.");
  }

  return proprietaire.id;
}

export function slug(valeur: string): string {
  return valeur
    .toLowerCase()
    .normalize("NFD")
    // Diacritiques décomposés par NFD, en notation échappée : des caractères
    // combinants écrits littéralement seraient invisibles à la relecture.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
