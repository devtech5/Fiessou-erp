import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { organizations, paiementsAbonnement } from "@/db/schema";

import { etatAbonnement, type EtatAbonnement } from "./calcul";

const jour = (v: Date | string | null) => (v === null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export async function paiementsDe(organizationId: string) {
  return db
    .select()
    .from(paiementsAbonnement)
    .where(eq(paiementsAbonnement.organizationId, organizationId))
    .orderBy(desc(paiementsAbonnement.recuLe), desc(paiementsAbonnement.createdAt));
}

export async function abonnementDe(organizationId: string) {
  const [o] = await db
    .select({ nom: organizations.name, statut: organizations.status, essai: organizations.trialEndsAt, paye: organizations.payeJusquAu, plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  return o ?? null;
}

export interface LigneEntreprise {
  id: string;
  nom: string;
  pays: string;
  creeeLe: Date;
  plan: string | null;
  statut: "essai" | "actif" | "suspendu" | "resilie";
  essaiFinLe: string | null;
  payeJusquAu: string | null;
  etat: EtatAbonnement;
  membres: number;
  derniereActivite: Date | null;
  encaisse: number;
}

/**
 * Toutes les entreprises, pour la console de la plateforme. Seule requête de
 * l'application qui ne filtre pas sur `organization_id` : elle est réservée
 * aux administrateurs de Fiessou, et ne lit que des métadonnées de compte.
 */
export async function toutesLesEntreprises(aujourdhui: string): Promise<LigneEntreprise[]> {
  const lignes = await db.execute<{
    id: string;
    nom: string;
    pays: string;
    cree_le: string | Date;
    plan: string | null;
    statut: LigneEntreprise["statut"];
    essai: string | Date | null;
    paye: string | Date | null;
    membres: string;
    activite: string | Date | null;
    encaisse: string;
  }>(sql`
    select o.id, o.name as nom, o.country_code as pays, o.created_at as cree_le, o.plan, o.status as statut,
           o.trial_ends_at as essai, o.paye_jusqu_au as paye,
           (select count(*) from memberships m where m.organization_id = o.id and m.status = 'actif') as membres,
           (select max(a.created_at) from audit_logs a where a.organization_id = o.id) as activite,
           (select coalesce(sum(p.montant), 0) from paiements_abonnement p where p.organization_id = o.id) as encaisse
    from organizations o
    order by o.created_at desc
  `);
  return lignes.map((l) => {
    const essaiFinLe = jour(l.essai);
    const payeJusquAu = jour(l.paye);
    return {
      id: l.id,
      nom: l.nom,
      pays: l.pays,
      creeeLe: new Date(l.cree_le),
      plan: l.plan,
      statut: l.statut,
      essaiFinLe,
      payeJusquAu,
      etat: etatAbonnement({ statut: l.statut, essaiFinLe, payeJusquAu }, aujourdhui),
      membres: Number(l.membres),
      derniereActivite: l.activite ? new Date(l.activite) : null,
      encaisse: Number(l.encaisse),
    };
  });
}
