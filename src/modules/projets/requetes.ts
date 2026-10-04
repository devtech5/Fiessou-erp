import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { urlSignee } from "@/lib/stockage";

import { suiviBudget, type SuiviBudget } from "./calcul";
import type { MoyenDepense, NaturePieceProjet, StatutDepense, StatutProjet } from "./schema";

const iso = (v: unknown): string | null =>
  v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

const nombreOuNul = (v: string | number | null) => (v === null ? null : Number(v));

export interface ProjetVue {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  client: string | null;
  responsableUserId: string | null;
  responsable: string | null;
  budget: number | null;
  debut: string | null;
  fin: string | null;
  statut: StatutProjet;
  suivi: SuiviBudget;
  depenses: number;
  photos: number;
}

type LigneProjet = {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  client: string | null;
  responsable_user_id: string | null;
  responsable: string | null;
  budget: string | null;
  debut: string | Date | null;
  fin: string | Date | null;
  statut: StatutProjet;
  engage: string;
  paye: string;
  en_attente: string;
  nb_depenses: string;
  photos: string;
};

function versVue(l: LigneProjet): ProjetVue {
  const budget = nombreOuNul(l.budget);
  // Les sommes viennent de la base ; le suivi les relit par la même règle que les tests figent.
  const suivi = suiviBudget(budget, [
    { statut: "payee", montant: Number(l.paye) },
    { statut: "approuvee", montant: Number(l.engage) - Number(l.paye) },
    { statut: "demandee", montant: Number(l.en_attente) },
  ]);
  return {
    id: l.id,
    code: l.code,
    nom: l.nom,
    description: l.description,
    client: l.client,
    responsableUserId: l.responsable_user_id,
    responsable: l.responsable,
    budget,
    debut: iso(l.debut),
    fin: iso(l.fin),
    statut: l.statut,
    suivi,
    depenses: Number(l.nb_depenses),
    photos: Number(l.photos),
  };
}

function requeteProjets(organizationId: string, projetId?: string) {
  return sql`
    select p.id, p.code, p.nom, p.description, t.nom as client, p.responsable_user_id,
           u.full_name as responsable, p.budget, p.debut, p.fin, p.statut,
           coalesce(sum(d.montant) filter (where d.statut in ('approuvee', 'payee')), 0) as engage,
           coalesce(sum(d.montant) filter (where d.statut = 'payee'), 0) as paye,
           coalesce(sum(d.montant) filter (where d.statut = 'demandee'), 0) as en_attente,
           count(d.id) filter (where d.statut not in ('rejetee', 'annulee')) as nb_depenses,
           (select count(*) from pieces_projet x where x.projet_id = p.id and x.nature = 'photo') as photos
    from projets p
      left join tiers t on t.id = p.client_id
      left join users u on u.id = p.responsable_user_id
      left join depenses d on d.projet_id = p.id
    where p.organization_id = ${organizationId} and p.deleted_at is null
      ${projetId ? sql`and p.id = ${projetId}` : sql``}
    group by p.id, t.nom, u.full_name
    order by case p.statut when 'en_cours' then 0 when 'preparation' then 1 when 'suspendu' then 2 else 3 end, p.code desc
  `;
}

export async function listerProjets(organizationId: string): Promise<ProjetVue[]> {
  const lignes = await db.execute<LigneProjet>(requeteProjets(organizationId));
  return lignes.map(versVue);
}

export interface DepenseVue {
  id: string;
  numero: string;
  projetId: string | null;
  projet: string | null;
  objet: string;
  categorie: string;
  fournisseur: string | null;
  montant: number;
  tauxTva: number;
  statut: StatutDepense;
  demandeeLe: Date;
  demandeur: string | null;
  demandeurId: string | null;
  approuveeLe: Date | null;
  approbateur: string | null;
  payeeLe: Date | null;
  payeur: string | null;
  moyen: MoyenDepense | null;
  referencePaiement: string | null;
  ecriture: string | null;
  motif: string | null;
  preuves: number;
}

export async function listerDepenses(organizationId: string, projetId?: string): Promise<DepenseVue[]> {
  const lignes = await db.execute<{
    id: string;
    numero: string;
    projet_id: string | null;
    projet: string | null;
    objet: string;
    categorie: string;
    fournisseur: string | null;
    montant: string;
    taux_tva: number;
    statut: StatutDepense;
    demandee_le: string | Date;
    demandeur: string | null;
    demandee_par_user_id: string | null;
    approuvee_le: string | Date | null;
    approbateur: string | null;
    payee_le: string | Date | null;
    payeur: string | null;
    moyen: MoyenDepense | null;
    reference_paiement: string | null;
    ecriture: string | null;
    motif: string | null;
    preuves: string;
  }>(sql`
    select d.id, d.numero, d.projet_id, p.code || ' · ' || p.nom as projet, d.objet, d.categorie,
           coalesce(f.nom, d.fournisseur_libelle) as fournisseur, d.montant, d.taux_tva, d.statut,
           d.demandee_le, ud.full_name as demandeur, d.demandee_par_user_id,
           d.approuvee_le, ua.full_name as approbateur, d.payee_le, up.full_name as payeur,
           d.moyen, d.reference_paiement, d.ecriture, d.motif,
           (select count(*) from pieces_projet x where x.depense_id = d.id and x.nature in ('preuve_paiement', 'facture')) as preuves
    from depenses d
      left join projets p on p.id = d.projet_id
      left join tiers f on f.id = d.fournisseur_id
      left join users ud on ud.id = d.demandee_par_user_id
      left join users ua on ua.id = d.approuvee_par_user_id
      left join users up on up.id = d.payee_par_user_id
    where d.organization_id = ${organizationId} and d.deleted_at is null
      ${projetId ? sql`and d.projet_id = ${projetId}` : sql``}
    order by case d.statut when 'demandee' then 0 when 'approuvee' then 1 when 'payee' then 2 else 3 end, d.demandee_le desc
  `);
  const date = (v: string | Date | null) => (v === null ? null : new Date(v));
  return lignes.map((l) => ({
    id: l.id,
    numero: l.numero,
    projetId: l.projet_id,
    projet: l.projet,
    objet: l.objet,
    categorie: l.categorie,
    fournisseur: l.fournisseur,
    montant: Number(l.montant),
    tauxTva: Number(l.taux_tva),
    statut: l.statut,
    demandeeLe: new Date(l.demandee_le),
    demandeur: l.demandeur,
    demandeurId: l.demandee_par_user_id,
    approuveeLe: date(l.approuvee_le),
    approbateur: l.approbateur,
    payeeLe: date(l.payee_le),
    payeur: l.payeur,
    moyen: l.moyen,
    referencePaiement: l.reference_paiement,
    ecriture: l.ecriture,
    motif: l.motif,
    preuves: Number(l.preuves),
  }));
}

export interface PieceVue {
  id: string;
  nature: NaturePieceProjet;
  legende: string | null;
  nomFichier: string;
  typeMime: string;
  depenseId: string | null;
  depose: Date;
  auteur: string | null;
  /** URL signée, valable cinq minutes. Nulle si le dépôt n'est pas joignable. */
  url: string | null;
}

/** Pièces d'un projet (y compris celles de ses dépenses), URL signées au rendu. */
export async function piecesDuProjet(organizationId: string, projetId: string): Promise<PieceVue[]> {
  const lignes = await db.execute<{
    id: string;
    nature: NaturePieceProjet;
    legende: string | null;
    nom_fichier: string;
    type_mime: string;
    depense_id: string | null;
    created_at: string | Date;
    auteur: string | null;
    chemin: string;
  }>(sql`
    select x.id, x.nature, x.legende, x.nom_fichier, x.type_mime, x.depense_id, x.created_at,
           u.full_name as auteur, x.chemin
    from pieces_projet x left join users u on u.id = x.depose_par_user_id
    where x.organization_id = ${organizationId} and x.projet_id = ${projetId}
    order by x.created_at desc
  `);
  return Promise.all(
    lignes.map(async (l) => ({
      id: l.id,
      nature: l.nature,
      legende: l.legende,
      nomFichier: l.nom_fichier,
      typeMime: l.type_mime,
      depenseId: l.depense_id,
      depose: new Date(l.created_at),
      auteur: l.auteur,
      url: await urlSignee(l.chemin),
    })),
  );
}

export async function ficheProjet(
  organizationId: string,
  projetId: string,
): Promise<{ projet: ProjetVue; depenses: DepenseVue[]; pieces: PieceVue[] } | null> {
  const [ligne] = await db.execute<LigneProjet>(requeteProjets(organizationId, projetId));
  if (!ligne) return null;
  const [depenses, pieces] = await Promise.all([
    listerDepenses(organizationId, projetId),
    piecesDuProjet(organizationId, projetId),
  ]);
  return { projet: versVue(ligne), depenses, pieces };
}

/** Pièces d'une dépense hors projet, pour l'écran des dépenses. */
export async function piecesParDepense(organizationId: string): Promise<Map<string, PieceVue[]>> {
  const lignes = await db.execute<{
    id: string;
    nature: NaturePieceProjet;
    legende: string | null;
    nom_fichier: string;
    type_mime: string;
    depense_id: string;
    created_at: string | Date;
    chemin: string;
  }>(sql`
    select id, nature, legende, nom_fichier, type_mime, depense_id, created_at, chemin
    from pieces_projet where organization_id = ${organizationId} and depense_id is not null
    order by created_at
  `);
  const parDepense = new Map<string, PieceVue[]>();
  for (const l of lignes) {
    const vue: PieceVue = {
      id: l.id,
      nature: l.nature,
      legende: l.legende,
      nomFichier: l.nom_fichier,
      typeMime: l.type_mime,
      depenseId: l.depense_id,
      depose: new Date(l.created_at),
      auteur: null,
      url: await urlSignee(l.chemin),
    };
    parDepense.set(l.depense_id, [...(parDepense.get(l.depense_id) ?? []), vue]);
  }
  return parDepense;
}

/** Membres actifs, pour désigner un responsable. */
export async function membresActifs(organizationId: string): Promise<{ userId: string; nom: string }[]> {
  const lignes = await db.execute<{ user_id: string; nom: string }>(sql`
    select m.user_id, u.full_name as nom
    from memberships m join users u on u.id = m.user_id
    where m.organization_id = ${organizationId} and m.status = 'actif'
    order by u.full_name
  `);
  return lignes.map((l) => ({ userId: l.user_id, nom: l.nom }));
}

/** Pour le tableau de bord : ce qui attend une signature, et ce qui a été payé sans preuve. */
export async function etatDepenses(organizationId: string): Promise<{ aApprouver: number; montantAApprouver: number; sansPreuve: number }> {
  const [l] = await db.execute<{ a_approuver: string; montant: string; sans_preuve: string }>(sql`
    select
      count(*) filter (where statut = 'demandee') as a_approuver,
      coalesce(sum(montant) filter (where statut = 'demandee'), 0) as montant,
      count(*) filter (where statut = 'payee' and not exists (
        select 1 from pieces_projet x where x.depense_id = depenses.id and x.nature in ('preuve_paiement', 'facture')
      )) as sans_preuve
    from depenses where organization_id = ${organizationId} and deleted_at is null
  `);
  return {
    aApprouver: Number(l?.a_approuver ?? 0),
    montantAApprouver: Number(l?.montant ?? 0),
    sansPreuve: Number(l?.sans_preuve ?? 0),
  };
}

export async function aUnProjet(organizationId: string): Promise<boolean> {
  const [l] = await db.execute<{ id: string }>(sql`select id from projets where organization_id = ${organizationId} limit 1`);
  return Boolean(l);
}
