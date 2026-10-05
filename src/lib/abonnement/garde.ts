import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { env } from "@/env";
import { session } from "@/lib/auth/dal";

import { etatAbonnement, type EtatAbonnement } from "./calcul";

const jour = (v: Date | string | null) => (v === null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

/**
 * État d'abonnement de l'entreprise active, une fois par rendu.
 *
 * L'instance de démonstration n'est jamais coupée : un prospect qui visite ne
 * doit pas tomber sur une entreprise en lecture seule.
 */
export const abonnementCourant = cache(async (): Promise<EtatAbonnement | null> => {
  const active = await session();
  if (!active?.organizationId) return null;
  const [o] = await db
    .select({ statut: organizations.status, essai: organizations.trialEndsAt, paye: organizations.payeJusquAu })
    .from(organizations)
    .where(eq(organizations.id, active.organizationId));
  if (!o) return null;
  const etat = etatAbonnement({ statut: o.statut, essaiFinLe: jour(o.essai), payeJusquAu: jour(o.paye) }, new Date().toISOString().slice(0, 10));
  if (env.INSTANCE_DEMO === "1") return { ...etat, acces: "complet", message: null, gravite: null };
  return etat;
});

/** Adresse de la session parmi les administrateurs de la plateforme ? */
export function estAdminPlateforme(email: string | null): boolean {
  if (!email) return false;
  return env.ADMINS_PLATEFORME.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
