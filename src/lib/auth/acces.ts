import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  accesModules,
  memberships,
  organizationModules,
  rolePermissions,
  roles,
  users,
} from "@/db/schema";
import type { NiveauAcces } from "@/lib/droits/acces";
import { presetRole, resoudreDroits, type Droit } from "@/lib/droits/catalogue";

/** Modules coupés pour l'entreprise. */
export async function modulesCoupes(organizationId: string): Promise<Set<string>> {
  const lignes = await db
    .select({ cle: organizationModules.moduleKey })
    .from(organizationModules)
    .where(and(eq(organizationModules.organizationId, organizationId), eq(organizationModules.enabled, false)));
  return new Set(lignes.map((l) => l.cle));
}

export interface FicheAcces {
  membershipId: string;
  userId: string;
  nom: string;
  email: string | null;
  roleNom: string;
  proprietaire: boolean;
  /** Ce que le rôle accorde, avant restriction : le plafond. */
  droitsDuRole: Set<Droit>;
  /** Niveaux posés, par module. Absent : complet. */
  niveaux: Map<string, NiveauAcces>;
}

/**
 * Un membre de l'entreprise, son rôle et ses restrictions par module.
 * Rend `null` si le rattachement n'appartient pas à l'entreprise : un
 * identifiant venu du navigateur ne doit rien ouvrir chez le voisin.
 */
export async function ficheAcces(
  organizationId: string,
  membershipId: string,
): Promise<FicheAcces | null> {
  const [membre] = await db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      nom: users.fullName,
      email: users.email,
      roleId: roles.id,
      roleCle: roles.key,
      roleNom: roles.name,
      proprietaire: memberships.isOwner,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.id, membershipId), eq(memberships.organizationId, organizationId)));

  if (!membre) return null;

  const accords =
    membre.proprietaire || presetRole(membre.roleCle)
      ? []
      : await db
          .select({ cle: rolePermissions.permissionKey })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, membre.roleId));

  const niveaux = await db
    .select({ cle: accesModules.moduleKey, niveau: accesModules.niveau })
    .from(accesModules)
    .where(eq(accesModules.membershipId, membre.membershipId));

  return {
    membershipId: membre.membershipId,
    userId: membre.userId,
    nom: membre.nom,
    email: membre.email,
    roleNom: membre.roleNom,
    proprietaire: membre.proprietaire,
    droitsDuRole: resoudreDroits({
      cleRole: membre.roleCle,
      estProprietaire: membre.proprietaire,
      accords: accords.map((a) => a.cle),
    }),
    niveaux: new Map(niveaux.map((n) => [n.cle, n.niveau])),
  };
}

/** Nombre de modules restreints par membre, pour la liste. */
export async function restrictionsParMembre(organizationId: string): Promise<Map<string, number>> {
  const lignes = await db
    .select({ membershipId: accesModules.membershipId, niveau: accesModules.niveau })
    .from(accesModules)
    .where(eq(accesModules.organizationId, organizationId));

  const compte = new Map<string, number>();
  for (const l of lignes) {
    if (l.niveau === "complet") continue;
    compte.set(l.membershipId, (compte.get(l.membershipId) ?? 0) + 1);
  }
  return compte;
}
