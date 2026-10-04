import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";

import { contratsLocation, type StatutContrat, type StatutRessource, type TypeRessource } from "./schema";

const iso = (valeur: unknown): string =>
  valeur instanceof Date ? valeur.toISOString().slice(0, 10) : String(valeur).slice(0, 10);

export interface RessourceVue {
  id: string;
  code: string;
  designation: string;
  type: TypeRessource;
  categorie: string | null;
  statut: StatutRessource;
  quantite: number;
  tarifJour: number | null;
  tarifSemaine: number | null;
  tarifMois: number | null;
  caution: number;
  /** Exemplaires sortis aujourd'hui (contrats en cours couvrant la date). */
  sortis: number;
}

export async function listerRessources(organizationId: string): Promise<RessourceVue[]> {
  const lignes = await db.execute<{
    id: string;
    code: string;
    designation: string;
    type: TypeRessource;
    categorie: string | null;
    statut: StatutRessource;
    quantite: number;
    tarif_jour: string | null;
    tarif_semaine: string | null;
    tarif_mois: string | null;
    caution: string;
    sortis: string;
  }>(sql`
    select r.id, r.code, r.designation, r.type, r.categorie, r.statut, r.quantite,
           r.tarif_jour, r.tarif_semaine, r.tarif_mois, r.caution,
           coalesce((
             select sum(c.quantite) from contrats_location c
             where c.ressource_id = r.id and c.statut = 'en_cours'
               and c.debut <= current_date and c.fin >= current_date
           ), 0) as sortis
    from ressources r
    where r.organization_id = ${organizationId} and r.deleted_at is null
    order by r.type, r.code
  `);

  const nombre = (v: string | null) => (v === null ? null : Number(v));
  return lignes.map((l) => ({
    id: l.id,
    code: l.code,
    designation: l.designation,
    type: l.type,
    categorie: l.categorie,
    statut: l.statut,
    quantite: Number(l.quantite),
    tarifJour: nombre(l.tarif_jour),
    tarifSemaine: nombre(l.tarif_semaine),
    tarifMois: nombre(l.tarif_mois),
    caution: Number(l.caution),
    sortis: Number(l.sortis),
  }));
}

export interface ContratVue {
  id: string;
  numero: string;
  ressourceId: string;
  ressource: string;
  codeRessource: string;
  client: string;
  quantite: number;
  debut: string;
  fin: string;
  baseTarif: string;
  montant: number;
  caution: number;
  statut: StatutContrat;
  /** En cours et fin passée : le bien n'est pas revenu. */
  enRetard: boolean;
  etatRestitution: string | null;
  retenue: number;
  motif: string | null;
}

export async function listerContrats(organizationId: string): Promise<ContratVue[]> {
  const lignes = await db.execute<{
    id: string;
    numero: string;
    ressource_id: string;
    ressource: string;
    code_ressource: string;
    client: string;
    quantite: number;
    debut: string | Date;
    fin: string | Date;
    base_tarif: string;
    montant: string;
    caution: string;
    statut: StatutContrat;
    en_retard: boolean;
    etat_restitution: string | null;
    retenue: string;
    motif: string | null;
  }>(sql`
    select c.id, c.numero, c.ressource_id, r.designation as ressource, r.code as code_ressource,
           t.nom as client, c.quantite, c.debut, c.fin, c.base_tarif, c.montant, c.caution,
           c.statut, (c.statut = 'en_cours' and c.fin < current_date) as en_retard,
           c.etat_restitution, c.retenue, c.motif
    from contrats_location c
      join ressources r on r.id = c.ressource_id
      join tiers t on t.id = c.client_id
    where c.organization_id = ${organizationId} and c.deleted_at is null
    order by
      case c.statut when 'en_cours' then 0 when 'reserve' then 1 when 'restitue' then 2 else 3 end,
      c.debut desc
  `);

  return lignes.map((l) => ({
    id: l.id,
    numero: l.numero,
    ressourceId: l.ressource_id,
    ressource: l.ressource,
    codeRessource: l.code_ressource,
    client: l.client,
    quantite: Number(l.quantite),
    debut: iso(l.debut),
    fin: iso(l.fin),
    baseTarif: l.base_tarif,
    montant: Number(l.montant),
    caution: Number(l.caution),
    statut: l.statut,
    enRetard: l.en_retard === true,
    etatRestitution: l.etat_restitution,
    retenue: Number(l.retenue),
    motif: l.motif,
  }));
}

/** Contrats qui occupent la période, pour le planning. */
export async function occupations(
  organizationId: string,
  debut: string,
  fin: string,
): Promise<{ ressourceId: string; debut: string; fin: string; quantite: number; numero: string }[]> {
  const lignes = await db.execute<{
    ressource_id: string;
    debut: string | Date;
    fin: string | Date;
    quantite: number;
    numero: string;
  }>(sql`
    select ressource_id, debut, fin, quantite, numero
    from contrats_location
    where organization_id = ${organizationId}
      and statut in ('reserve', 'en_cours')
      and debut <= ${fin} and fin >= ${debut}
  `);
  return lignes.map((l) => ({
    ressourceId: l.ressource_id,
    debut: iso(l.debut),
    fin: iso(l.fin),
    quantite: Number(l.quantite),
    numero: l.numero,
  }));
}

export interface AbonnementVue {
  id: string;
  code: string;
  nom: string;
  telephone: string | null;
  formule: string;
  debut: string;
  fin: string;
  montant: number;
  seancesIncluses: number | null;
  seancesConsommees: number;
  derniereVenue: Date | null;
}

export async function listerAbonnements(organizationId: string): Promise<AbonnementVue[]> {
  const lignes = await db.execute<{
    id: string;
    code: string;
    nom: string;
    telephone: string | null;
    formule: string;
    debut: string | Date;
    fin: string | Date;
    montant: string;
    seances_incluses: number | null;
    consommees: string;
    derniere: string | Date | null;
  }>(sql`
    select a.id, a.code, a.nom, a.telephone, a.formule, a.debut, a.fin, a.montant,
           a.seances_incluses, coalesce(p.nombre, 0) as consommees, p.derniere
    from abonnements a
      left join (
        select abonnement_id, count(*) as nombre, max(venu_le) as derniere
        from passages_abonnement
        where organization_id = ${organizationId}
        group by abonnement_id
      ) p on p.abonnement_id = a.id
    where a.organization_id = ${organizationId} and a.deleted_at is null
    order by a.fin desc, a.code
  `);
  return lignes.map((l) => ({
    id: l.id,
    code: l.code,
    nom: l.nom,
    telephone: l.telephone,
    formule: l.formule,
    debut: iso(l.debut),
    fin: iso(l.fin),
    montant: Number(l.montant),
    seancesIncluses: l.seances_incluses === null ? null : Number(l.seances_incluses),
    seancesConsommees: Number(l.consommees),
    derniereVenue: l.derniere ? new Date(l.derniere) : null,
  }));
}

/** Pour le tableau de bord : biens non rendus et abonnements épuisés. */
export async function etatReservations(organizationId: string): Promise<{
  locationsEnRetard: number;
  abonnementsEpuises: number;
}> {
  const [ligne] = await db.execute<{ retard: string; epuises: string }>(sql`
    select
      (select count(*) from contrats_location
        where organization_id = ${organizationId} and statut = 'en_cours' and fin < current_date) as retard,
      (select count(*) from abonnements a
        where a.organization_id = ${organizationId} and a.fin >= current_date
          and a.seances_incluses is not null
          and a.seances_incluses <= (select count(*) from passages_abonnement p where p.abonnement_id = a.id)
      ) as epuises
  `);
  return {
    locationsEnRetard: Number(ligne?.retard ?? 0),
    abonnementsEpuises: Number(ligne?.epuises ?? 0),
  };
}

export async function aUneRessource(organizationId: string): Promise<boolean> {
  const [ligne] = await db
    .select({ id: contratsLocation.id })
    .from(contratsLocation)
    .where(eq(contratsLocation.organizationId, organizationId))
    .limit(1);
  if (ligne) return true;
  const [r] = await db.execute<{ id: string }>(sql`select id from ressources where organization_id = ${organizationId} limit 1`);
  return Boolean(r);
}
