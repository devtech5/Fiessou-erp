import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import type { CanalBillet, MoyenBillet, StatutBillet, StatutDepart } from "./schema";

export interface LigneVue {
  id: string;
  code: string;
  depart: string;
  arrivee: string;
  dureeMinutes: number;
  distanceKm: number | null;
  tarif: number;
  tauxTva: number;
  active: boolean;
  departs: number;
  recette: number;
}

/** Lignes, avec le nombre de départs programmés et la recette des billets non annulés. */
export async function listerLignes(organizationId: string): Promise<LigneVue[]> {
  const lignes = await db.execute<{
    id: string;
    code: string;
    depart: string;
    arrivee: string;
    duree_minutes: number;
    distance_km: number | null;
    tarif: string;
    taux_tva: number;
    active: boolean;
    departs: string;
    recette: string;
  }>(sql`
    select l.id, l.code, l.depart, l.arrivee, l.duree_minutes, l.distance_km, l.tarif, l.taux_tva, l.active,
           (select count(*) from departs d where d.ligne_id = l.id and d.statut <> 'annule') as departs,
           coalesce((
             select sum(b.montant) from billets b join departs d on d.id = b.depart_id
             where d.ligne_id = l.id and b.statut <> 'annule'
           ), 0) as recette
    from lignes_transport l
    where l.organization_id = ${organizationId} and l.deleted_at is null
    order by l.active desc, l.code
  `);
  return lignes.map((l) => ({
    id: l.id,
    code: l.code,
    depart: l.depart,
    arrivee: l.arrivee,
    dureeMinutes: Number(l.duree_minutes),
    distanceKm: l.distance_km === null ? null : Number(l.distance_km),
    tarif: Number(l.tarif),
    tauxTva: Number(l.taux_tva),
    active: l.active === true,
    departs: Number(l.departs),
    recette: Number(l.recette),
  }));
}

export interface DepartVue {
  id: string;
  reference: string;
  ligneId: string;
  codeLigne: string;
  villeDepart: string;
  villeArrivee: string;
  dureeMinutes: number;
  partLe: Date;
  vehicule: string;
  rangees: number;
  tarif: number;
  statut: StatutDepart;
  motif: string | null;
  vendus: number;
  embarques: number;
  recette: number;
}

/**
 * Départs à partir d'une date, avec leurs places vendues.
 *
 * Les comptes viennent des billets, jamais d'un compteur stocké sur le
 * départ : un compteur à côté des billets finit toujours par diverger.
 */
export async function listerDeparts(organizationId: string, depuis: Date): Promise<DepartVue[]> {
  const lignes = await db.execute<{
    id: string;
    reference: string;
    ligne_id: string;
    code: string;
    ville_depart: string;
    ville_arrivee: string;
    duree_minutes: number;
    part_le: string | Date;
    vehicule: string;
    rangees: number;
    tarif: string;
    statut: StatutDepart;
    motif: string | null;
    vendus: string;
    embarques: string;
    recette: string;
  }>(sql`
    select d.id, d.reference, d.ligne_id, l.code, l.depart as ville_depart, l.arrivee as ville_arrivee,
           l.duree_minutes, d.part_le, d.vehicule, d.rangees, d.tarif, d.statut, d.motif,
           count(b.id) filter (where b.statut <> 'annule') as vendus,
           count(b.id) filter (where b.statut = 'embarque') as embarques,
           coalesce(sum(b.montant) filter (where b.statut <> 'annule'), 0) as recette
    from departs d
      join lignes_transport l on l.id = d.ligne_id
      left join billets b on b.depart_id = d.id
    where d.organization_id = ${organizationId} and d.deleted_at is null
      and d.part_le >= ${depuis.toISOString()}
    group by d.id, l.id
    order by d.part_le, l.code
  `);
  return lignes.map((l) => ({
    id: l.id,
    reference: l.reference,
    ligneId: l.ligne_id,
    codeLigne: l.code,
    villeDepart: l.ville_depart,
    villeArrivee: l.ville_arrivee,
    dureeMinutes: Number(l.duree_minutes),
    partLe: new Date(l.part_le),
    vehicule: l.vehicule,
    rangees: Number(l.rangees),
    tarif: Number(l.tarif),
    statut: l.statut,
    motif: l.motif,
    vendus: Number(l.vendus),
    embarques: Number(l.embarques),
    recette: Number(l.recette),
  }));
}

/** Sièges occupés d'un ensemble de départs, pour le plan de places. */
export async function siegesOccupes(
  organizationId: string,
  departIds: string[],
): Promise<Record<string, string[]>> {
  if (departIds.length === 0) return {};
  const lignes = await db.execute<{ depart_id: string; siege: string }>(sql`
    select depart_id, siege from billets
    where organization_id = ${organizationId} and statut <> 'annule'
      and depart_id in (${sql.join(departIds.map((id) => sql`${id}`), sql`, `)})
  `);
  const occupes: Record<string, string[]> = {};
  for (const l of lignes) (occupes[l.depart_id] ??= []).push(l.siege);
  return occupes;
}

export interface BilletVue {
  id: string;
  numero: string;
  departId: string;
  reference: string;
  trajet: string;
  partLe: Date;
  statutDepart: StatutDepart;
  siege: string;
  passager: string;
  telephone: string | null;
  piece: string | null;
  montant: number;
  canal: CanalBillet;
  moyen: MoyenBillet;
  statut: StatutBillet;
  motif: string | null;
}

export async function listerBillets(organizationId: string, limite = 200): Promise<BilletVue[]> {
  const lignes = await db.execute<{
    id: string;
    numero: string;
    depart_id: string;
    reference: string;
    trajet: string;
    part_le: string | Date;
    statut_depart: StatutDepart;
    siege: string;
    passager: string;
    telephone: string | null;
    piece: string | null;
    montant: string;
    canal: CanalBillet;
    moyen: MoyenBillet;
    statut: StatutBillet;
    motif: string | null;
  }>(sql`
    select b.id, b.numero, b.depart_id, d.reference, l.depart || ' → ' || l.arrivee as trajet,
           d.part_le, d.statut as statut_depart, b.siege, b.passager, b.telephone, b.piece,
           b.montant, b.canal, b.moyen, b.statut, b.motif
    from billets b
      join departs d on d.id = b.depart_id
      join lignes_transport l on l.id = d.ligne_id
    where b.organization_id = ${organizationId} and b.deleted_at is null
    order by d.part_le desc, b.numero desc
    limit ${limite}
  `);
  return lignes.map((l) => ({
    id: l.id,
    numero: l.numero,
    departId: l.depart_id,
    reference: l.reference,
    trajet: l.trajet,
    partLe: new Date(l.part_le),
    statutDepart: l.statut_depart,
    siege: l.siege,
    passager: l.passager,
    telephone: l.telephone,
    piece: l.piece,
    montant: Number(l.montant),
    canal: l.canal,
    moyen: l.moyen,
    statut: l.statut,
    motif: l.motif,
  }));
}

export async function aUneLigne(organizationId: string): Promise<boolean> {
  const [ligne] = await db.execute<{ id: string }>(
    sql`select id from lignes_transport where organization_id = ${organizationId} limit 1`,
  );
  return Boolean(ligne);
}
