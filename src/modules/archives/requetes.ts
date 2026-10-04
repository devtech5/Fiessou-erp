import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";

export interface ArchiveVue {
  id: string;
  numero: string;
  titre: string;
  dossier: string | null;
  description: string | null;
  nomFichier: string;
  typeMime: string;
  tailleOctets: number;
  empreinte: string;
  deposeLe: Date;
  retireeLe: Date | null;
  motifRetrait: string | null;
  auteurId: string;
  auteur: string;
  /** Ouvertures par quelqu'un d'autre que l'auteur : l'administrateur légal. */
  consultationsParAutres: number;
  derniereVerification: { le: Date; etat: string } | null;
}

type Ligne = {
  id: string;
  numero: string;
  titre: string;
  dossier: string | null;
  description: string | null;
  nom_fichier: string;
  type_mime: string;
  taille_octets: string | number;
  empreinte: string;
  cree_le: string | Date;
  retiree_le: string | Date | null;
  motif_retrait: string | null;
  user_id: string;
  auteur: string | null;
  consultations: string | number;
  verifiee_le: string | Date | null;
  verification: string | null;
};

const enDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

function vue(l: Ligne): ArchiveVue {
  return {
    id: l.id,
    numero: l.numero,
    titre: l.titre,
    dossier: l.dossier,
    description: l.description,
    nomFichier: l.nom_fichier,
    typeMime: l.type_mime,
    tailleOctets: Number(l.taille_octets),
    empreinte: l.empreinte,
    deposeLe: enDate(l.cree_le),
    retireeLe: l.retiree_le ? enDate(l.retiree_le) : null,
    motifRetrait: l.motif_retrait,
    auteurId: l.user_id,
    auteur: l.auteur ?? "Ancien membre",
    consultationsParAutres: Number(l.consultations),
    derniereVerification: l.verifiee_le && l.verification ? { le: enDate(l.verifiee_le), etat: l.verification } : null,
  };
}

/**
 * Lecture commune. Le filtre arrive déjà composé : il porte TOUJOURS
 * l'entreprise, ajoutée ici et non par l'appelant.
 */
async function lire(organizationId: string, filtre: SQL): Promise<ArchiveVue[]> {
  const lignes = await db.execute<Ligne>(sql`
    select a.id, a.numero, a.titre, a.dossier, a.description, a.nom_fichier, a.type_mime,
           a.taille_octets, a.empreinte, a.created_at as cree_le, a.retiree_le, a.motif_retrait,
           a.user_id, u.full_name as auteur,
           (select count(*) from audit_logs j
             where j.organization_id = a.organization_id and j.entity_type = 'archive'
               and j.entity_id = a.id and j.action = 'archive.ouvrir' and j.user_id is distinct from a.user_id
           ) as consultations,
           v.created_at as verifiee_le, v.after->>'etat' as verification
    from archives a
    left join users u on u.id = a.user_id
    left join lateral (
      select j.created_at, j.after from audit_logs j
      where j.organization_id = a.organization_id and j.entity_type = 'archive'
        and j.entity_id = a.id and j.action = 'archive.verifier'
      order by j.created_at desc limit 1
    ) v on true
    where a.organization_id = ${organizationId} and a.deleted_at is null and ${filtre}
    order by a.created_at desc
    limit 500
  `);
  return lignes.map(vue);
}

/** L'espace d'une personne : ce qu'elle a déposé et n'a pas retiré. */
export function mesArchives(organizationId: string, userId: string): Promise<ArchiveVue[]> {
  return lire(organizationId, sql`a.user_id = ${userId} and a.retiree_le is null`);
}

/** Toutes les archives de l'entreprise, retirées comprises : la vue de l'administrateur légal. */
export function toutesArchives(organizationId: string, membre?: string | null): Promise<ArchiveVue[]> {
  return lire(organizationId, membre ? sql`a.user_id = ${membre}` : sql`true`);
}

export interface TitulaireArchives {
  userId: string;
  nom: string;
  fichiers: number;
  octets: number;
}

/** Les personnes qui ont archivé, avec leur volume : le filtre de l'écran de supervision. */
export async function titulaires(organizationId: string): Promise<TitulaireArchives[]> {
  const lignes = await db.execute<{ user_id: string; nom: string | null; fichiers: string; octets: string }>(sql`
    select a.user_id, u.full_name as nom, count(*) as fichiers,
           coalesce(sum(a.taille_octets) filter (where a.retiree_le is null), 0) as octets
    from archives a left join users u on u.id = a.user_id
    where a.organization_id = ${organizationId} and a.deleted_at is null
    group by a.user_id, u.full_name
    order by u.full_name
  `);
  return lignes.map((l) => ({
    userId: l.user_id,
    nom: l.nom ?? "Ancien membre",
    fichiers: Number(l.fichiers),
    octets: Number(l.octets),
  }));
}

export interface EntreeJournal {
  id: string;
  le: Date;
  action: string;
  acteur: string;
  numero: string | null;
  titre: string | null;
  titulaire: string | null;
  detail: Record<string, unknown> | null;
}

/** Les derniers gestes sur les archives : dépôts, ouvertures, retraits, vérifications. */
export async function journalArchives(organizationId: string, limite = 40): Promise<EntreeJournal[]> {
  const lignes = await db.execute<{
    id: string;
    le: string | Date;
    action: string;
    acteur: string | null;
    numero: string | null;
    titre: string | null;
    titulaire: string | null;
    detail: Record<string, unknown> | null;
  }>(sql`
    select j.id, j.created_at as le, j.action, u.full_name as acteur, a.numero, a.titre,
           t.full_name as titulaire, j.after as detail
    from audit_logs j
    left join users u on u.id = j.user_id
    left join archives a on a.id = j.entity_id and a.organization_id = j.organization_id
    left join users t on t.id = a.user_id
    where j.organization_id = ${organizationId} and j.entity_type = 'archive'
    order by j.created_at desc
    limit ${limite}
  `);
  return lignes.map((l) => ({
    id: l.id,
    le: enDate(l.le),
    action: l.action,
    acteur: l.acteur ?? "Système",
    numero: l.numero,
    titre: l.titre,
    titulaire: l.titulaire,
    detail: l.detail,
  }));
}
