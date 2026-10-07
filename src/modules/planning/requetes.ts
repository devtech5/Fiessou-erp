import "server-only";

import { and, asc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema";

import type { Creneau, Plage } from "./calcul";
import { creneauxPlanning, horairesPlanning } from "./schema";

export async function fuseauEntreprise(organizationId: string): Promise<string> {
  const [org] = await db.select({ fuseau: organizations.timezone }).from(organizations).where(eq(organizations.id, organizationId));
  return org?.fuseau || "Africa/Abidjan";
}

export interface MembrePlanning {
  userId: string;
  nom: string;
}

/** Les membres actifs : ceux dont on tient le planning. */
export async function membresPlanning(organizationId: string): Promise<MembrePlanning[]> {
  const lignes = await db.execute<{ user_id: string; nom: string }>(sql`
    select m.user_id, u.full_name as nom
    from memberships m join users u on u.id = m.user_id
    where m.organization_id = ${organizationId} and m.status = 'actif'
    order by u.full_name
  `);
  return lignes.map((l) => ({ userId: l.user_id, nom: l.nom }));
}

/** Créneaux qui touchent la fenêtre, pour ces personnes (toutes si la liste est absente). */
export async function creneauxSur(organizationId: string, du: Date, au: Date, userIds?: string[]): Promise<Creneau[]> {
  if (userIds && userIds.length === 0) return [];
  return db
    .select({
      id: creneauxPlanning.id,
      userId: creneauxPlanning.userId,
      statut: creneauxPlanning.statut,
      debut: creneauxPlanning.debut,
      fin: creneauxPlanning.fin,
      lieu: creneauxPlanning.lieu,
      note: creneauxPlanning.note,
    })
    .from(creneauxPlanning)
    .where(
      and(
        eq(creneauxPlanning.organizationId, organizationId),
        isNull(creneauxPlanning.deletedAt),
        lt(creneauxPlanning.debut, au),
        gt(creneauxPlanning.fin, du),
        userIds ? inArray(creneauxPlanning.userId, userIds) : undefined,
      ),
    )
    .orderBy(asc(creneauxPlanning.debut));
}

/** Semaine type de chacun, rangée par personne. */
export async function horairesDe(organizationId: string, userIds?: string[]): Promise<Map<string, Plage[]>> {
  const parPersonne = new Map<string, Plage[]>();
  if (userIds && userIds.length === 0) return parPersonne;
  const lignes = await db
    .select({ userId: horairesPlanning.userId, jour: horairesPlanning.jour, debutMinutes: horairesPlanning.debutMinutes, finMinutes: horairesPlanning.finMinutes })
    .from(horairesPlanning)
    .where(
      and(
        eq(horairesPlanning.organizationId, organizationId),
        isNull(horairesPlanning.deletedAt),
        userIds ? inArray(horairesPlanning.userId, userIds) : undefined,
      ),
    )
    .orderBy(asc(horairesPlanning.jour), asc(horairesPlanning.debutMinutes));
  for (const l of lignes) {
    const liste = parPersonne.get(l.userId) ?? [];
    liste.push({ jour: l.jour, debutMinutes: l.debutMinutes, finMinutes: l.finMinutes });
    parPersonne.set(l.userId, liste);
  }
  return parPersonne;
}
