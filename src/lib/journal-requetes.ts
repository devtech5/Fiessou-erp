import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";

import { categorieAction, type Categorie } from "./journal";

export interface FiltresJournal {
  membre?: string | null;
  categorie?: Categorie | null;
  /** Jours ISO, bornes comprises. */
  du?: string | null;
  au?: string | null;
  recherche?: string | null;
}

export interface LigneJournal {
  id: string;
  le: Date;
  action: string;
  userId: string | null;
  acteur: string;
  entite: string | null;
  avant: unknown;
  apres: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}

const enDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** Filtres communs, hors famille. L'entreprise est TOUJOURS posée ici. */
function conditions(organizationId: string, f: FiltresJournal): SQL {
  const morceaux: SQL[] = [sql`j.organization_id = ${organizationId}`];
  if (f.membre) morceaux.push(sql`j.user_id = ${f.membre}`);
  // Les bornes sont des jours : `au` inclut toute sa journée.
  if (f.du) morceaux.push(sql`j.created_at >= ${`${f.du}T00:00:00Z`}::timestamptz`);
  if (f.au) morceaux.push(sql`j.created_at < (${`${f.au}T00:00:00Z`}::timestamptz + interval '1 day')`);
  if (f.recherche) {
    const motif = `%${f.recherche.replace(/[%_\\]/g, "\\$&")}%`;
    morceaux.push(
      sql`(j.action ilike ${motif} or coalesce(j.after::text, '') ilike ${motif} or coalesce(j.before::text, '') ilike ${motif} or coalesce(u.full_name, '') ilike ${motif})`,
    );
  }
  return sql.join(morceaux, sql` and `);
}

/** Nombre de gestes par verbe, sur les filtres hors famille : sert aux compteurs et au filtre par famille. */
async function comptesParAction(organizationId: string, f: FiltresJournal): Promise<Map<string, number>> {
  const lignes = await db.execute<{ action: string; n: string }>(sql`
    select j.action, count(*) as n
    from audit_logs j left join users u on u.id = j.user_id
    where ${conditions(organizationId, f)}
    group by j.action
  `);
  return new Map(lignes.map((l) => [l.action, Number(l.n)]));
}

export const PAR_PAGE = 50;

export async function lireJournal(
  organizationId: string,
  f: FiltresJournal,
  page = 1,
  limite = PAR_PAGE,
): Promise<{ lignes: LigneJournal[]; total: number; parCategorie: Record<Categorie, number> }> {
  const comptes = await comptesParAction(organizationId, f);

  const parCategorie: Record<Categorie, number> = {
    connexion: 0,
    creation: 0,
    modification: 0,
    affectation: 0,
    suppression: 0,
    consultation: 0,
  };
  for (const [action, n] of comptes) parCategorie[categorieAction(action)] += n;

  // La famille se déduit du verbe en TypeScript : on la ramène à la liste des
  // verbes présents, plutôt que de recopier la règle en SQL.
  const actions = f.categorie ? [...comptes.keys()].filter((a) => categorieAction(a) === f.categorie) : null;
  if (actions && actions.length === 0) return { lignes: [], total: 0, parCategorie };

  const total = actions ? actions.reduce((s, a) => s + (comptes.get(a) ?? 0), 0) : [...comptes.values()].reduce((s, n) => s + n, 0);
  const filtreFamille = actions ? sql` and j.action in (${sql.join(actions.map((a) => sql`${a}`), sql`, `)})` : sql``;

  const lignes = await db.execute<{
    id: string;
    le: string | Date;
    action: string;
    user_id: string | null;
    acteur: string | null;
    entite: string | null;
    avant: unknown;
    apres: unknown;
    ip_address: string | null;
    user_agent: string | null;
  }>(sql`
    select j.id, j.created_at as le, j.action, j.user_id, u.full_name as acteur, j.entity_type as entite,
           j.before as avant, j.after as apres, j.ip_address, j.user_agent
    from audit_logs j left join users u on u.id = j.user_id
    where ${conditions(organizationId, f)}${filtreFamille}
    order by j.created_at desc, j.id desc
    limit ${limite} offset ${(Math.max(1, page) - 1) * limite}
  `);

  return {
    total,
    parCategorie,
    lignes: lignes.map((l) => ({
      id: l.id,
      le: enDate(l.le),
      action: l.action,
      userId: l.user_id,
      acteur: l.acteur ?? (l.user_id ? "Ancien membre" : "Système"),
      entite: l.entite,
      avant: typeof l.avant === "string" ? JSON.parse(l.avant) : l.avant,
      apres: typeof l.apres === "string" ? JSON.parse(l.apres) : l.apres,
      ipAddress: l.ip_address,
      userAgent: l.user_agent,
    })),
  };
}

export interface PresenceMembre {
  userId: string;
  nom: string;
  derniereConnexion: Date | null;
  derniereDeconnexion: Date | null;
  echecsSeptJours: number;
  gestesSeptJours: number;
}

/** Pour chaque membre : sa dernière entrée, sa dernière sortie, ses échecs et son activité de la semaine. */
export async function presences(organizationId: string): Promise<PresenceMembre[]> {
  const lignes = await db.execute<{
    user_id: string;
    nom: string;
    connexion: string | Date | null;
    deconnexion: string | Date | null;
    echecs: string;
    gestes: string;
  }>(sql`
    select m.user_id, u.full_name as nom,
      (select max(created_at) from audit_logs j where j.organization_id = m.organization_id and j.user_id = m.user_id and j.action = 'connexion.reussie') as connexion,
      (select max(created_at) from audit_logs j where j.organization_id = m.organization_id and j.user_id = m.user_id and j.action = 'deconnexion') as deconnexion,
      (select count(*) from audit_logs j where j.organization_id = m.organization_id and j.user_id = m.user_id and j.action = 'connexion.refusee' and j.created_at > now() - interval '7 days') as echecs,
      (select count(*) from audit_logs j where j.organization_id = m.organization_id and j.user_id = m.user_id and j.action not like 'connexion%' and j.action <> 'deconnexion' and j.created_at > now() - interval '7 days') as gestes
    from memberships m join users u on u.id = m.user_id
    where m.organization_id = ${organizationId} and m.status = 'actif'
    order by u.full_name
  `);
  return lignes.map((l) => ({
    userId: l.user_id,
    nom: l.nom,
    derniereConnexion: l.connexion ? enDate(l.connexion) : null,
    derniereDeconnexion: l.deconnexion ? enDate(l.deconnexion) : null,
    echecsSeptJours: Number(l.echecs),
    gestesSeptJours: Number(l.gestes),
  }));
}

/** Toutes les personnes qui apparaissent au journal, membres actuels ou anciens : le filtre par personne. */
export async function acteursJournal(organizationId: string): Promise<{ userId: string; nom: string }[]> {
  const lignes = await db.execute<{ user_id: string; nom: string | null }>(sql`
    select distinct j.user_id, u.full_name as nom
    from audit_logs j left join users u on u.id = j.user_id
    where j.organization_id = ${organizationId} and j.user_id is not null
    order by u.full_name
  `);
  return lignes.map((l) => ({ userId: l.user_id, nom: l.nom ?? "Ancien membre" }));
}
