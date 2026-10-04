import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { auditLogs, memberships } from "@/db/schema";
import { session } from "@/lib/auth/dal";
import { newId } from "@/lib/ids";

/**
 * Traçabilité : qui a fait quoi, quand, depuis où.
 *
 * Les modules qui journalisent DANS leur transaction continuent de le faire —
 * la trace y naît ou meurt avec l'opération. Ce module sert le reste : les
 * connexions, et les gestes dont l'écriture ne passe pas par une transaction
 * de module. Il complète la ligne avec l'adresse et l'appareil de la requête.
 *
 * Une trace qui échoue ne fait pas échouer le geste : elle le signale en
 * console. Refuser une vente parce que le journal n'a pas pu s'écrire
 * bloquerait la caisse pour une raison que le caissier ne peut pas corriger.
 */

export interface Evenement {
  /** Verbe métier : `connexion.reussie`, `tache.attribuer`, `stock.mouvement`. */
  action: string;
  entite?: string | null;
  entiteId?: string | null;
  avant?: unknown;
  apres?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function contexteRequete(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const entetes = await headers();
    return {
      ipAddress:
        entetes.get("x-forwarded-for")?.split(",")[0]?.trim() || entetes.get("x-real-ip") || null,
      userAgent: entetes.get("user-agent")?.slice(0, 300) ?? null,
    };
  } catch {
    // Hors requête (script, amorçage) : pas d'en-têtes, la trace reste utile.
    return { ipAddress: null, userAgent: null };
  }
}

async function ecrire(organizationIds: string[], userId: string | null, evenement: Evenement): Promise<void> {
  if (organizationIds.length === 0) return;
  try {
    const { ipAddress, userAgent } = await contexteRequete();
    await db.insert(auditLogs).values(
      organizationIds.map((organizationId) => ({
        id: newId(),
        organizationId,
        userId,
        action: evenement.action,
        entityType: evenement.entite ?? evenement.action.split(".")[0],
        // La colonne est un uuid : un identifiant d'une autre forme irait dans le détail.
        entityId: evenement.entiteId && UUID.test(evenement.entiteId) ? evenement.entiteId : null,
        before: evenement.avant ?? null,
        after: evenement.apres ?? null,
        ipAddress,
        userAgent,
      })),
    );
  } catch (erreur) {
    console.error(`Journal : trace « ${evenement.action} » perdue`, erreur);
  }
}

/** Trace un geste de la personne connectée, dans son entreprise active. */
export async function tracer(evenement: Evenement): Promise<void> {
  const active = await session();
  if (!active?.organizationId) return;
  await ecrire([active.organizationId], active.userId, evenement);
}

/** Trace un geste pour une entreprise et une personne données. */
export async function tracerPour(organizationId: string, userId: string | null, evenement: Evenement): Promise<void> {
  await ecrire([organizationId], userId, evenement);
}

/**
 * Trace un geste dans TOUTES les entreprises de la personne.
 *
 * Pour la connexion et la déconnexion : la personne n'a pas encore choisi son
 * entreprise, et chacune de celles qui lui ont ouvert un accès doit pouvoir
 * voir qu'elle est entrée.
 */
export async function tracerPartout(userId: string, evenement: Evenement): Promise<void> {
  const lignes = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "actif")));
  await ecrire(
    lignes.map((l) => l.organizationId),
    userId,
    evenement,
  );
}
