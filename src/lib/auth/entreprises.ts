import "server-only";

import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { memberships, organizations, roles } from "@/db/schema";

export interface EntrepriseAccessible {
  id: string;
  nom: string;
  slug: string;
  /** Étiquette affichée à côté du nom : essai, actif, suspendu. */
  statut: string;
  pays: string;
  roleNom: string;
  proprietaire: boolean;
}

/**
 * Entreprises auxquelles l'utilisateur a réellement accès.
 *
 * Filtré sur les rattachements actifs : un accès révoqué disparaît du
 * sélecteur, sans invalider la session pour autant.
 *
 * `cache` déduplique l'appel sur la durée d'un rendu — la coque interroge la
 * liste dans son en-tête, et parfois de nouveau dans un menu.
 */
export const entreprisesAccessibles = cache(
  async (userId: string): Promise<EntrepriseAccessible[]> => {
    return db
      .select({
        id: organizations.id,
        nom: organizations.name,
        slug: organizations.slug,
        statut: organizations.status,
        pays: organizations.countryCode,
        roleNom: roles.name,
        proprietaire: memberships.isOwner,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(and(eq(memberships.userId, userId), eq(memberships.status, "actif")))
      .orderBy(organizations.name);
  },
);
