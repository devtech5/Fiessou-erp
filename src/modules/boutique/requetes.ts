import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import type { CodeUnite } from "@/lib/quantite";

import type { Heure } from "./calcul";

/**
 * Le jour d'un ticket, à l'heure d'Abidjan — comme les rapports de caisse :
 * un ticket de 23 h 30 appartient à la journée où il a été encaissé.
 */
const JOUR_VENTE = sql`(v.encaissee_le at time zone 'Africa/Abidjan')::date`;

export interface ChiffresJour {
  tickets: number;
  /** Total TTC encaissé : ce que le tiroir et le mobile money ont reçu. */
  chiffreAffaires: number;
  panierMoyen: number;
  remises: number;
  /** Ventes hors taxes moins coût de revient figé sur chaque ligne. */
  margeBrute: number;
  ventesHt: number;
  annulees: number;
}

/**
 * Chiffres d'une journée.
 *
 * Totaux de tickets et totaux de lignes se calculent SÉPARÉMENT : joindre les
 * lignes aux ventes compterait chaque ticket autant de fois qu'il a de lignes.
 */
export async function chiffresDuJour(organizationId: string, jour: string): Promise<ChiffresJour> {
  const [t] = await db.execute<{ tickets: string; ttc: string; remises: string; annulees: string }>(sql`
    select
      count(*) filter (where v.statut = 'encaissee') as tickets,
      coalesce(sum(v.total_ttc) filter (where v.statut = 'encaissee'), 0) as ttc,
      coalesce(sum(v.total_remise) filter (where v.statut = 'encaissee'), 0) as remises,
      count(*) filter (where v.statut = 'annulee') as annulees
    from ventes v
    where v.organization_id = ${organizationId} and v.deleted_at is null
      and ${JOUR_VENTE} = ${jour}::date
  `);
  const [l] = await db.execute<{ ht: string; cout: string }>(sql`
    select coalesce(sum(lv.montant_ht), 0) as ht,
           coalesce(round(sum(lv.quantite * lv.cout_unitaire)::numeric / 1000) + sum(lv.cout_main_oeuvre), 0) as cout
    from lignes_vente lv join ventes v on v.id = lv.vente_id
    where v.organization_id = ${organizationId} and v.statut = 'encaissee' and v.deleted_at is null
      and ${JOUR_VENTE} = ${jour}::date
  `);

  const tickets = Number(t?.tickets ?? 0);
  const chiffreAffaires = Number(t?.ttc ?? 0);
  const ventesHt = Number(l?.ht ?? 0);
  return {
    tickets,
    chiffreAffaires,
    panierMoyen: divideMoney(chiffreAffaires, tickets),
    remises: Number(t?.remises ?? 0),
    ventesHt,
    margeBrute: ventesHt - Number(l?.cout ?? 0),
    annulees: Number(t?.annulees ?? 0),
  };
}

/** Tickets et chiffre par heure de la journée, à l'heure d'Abidjan. */
export async function affluenceDuJour(organizationId: string, jour: string): Promise<Heure[]> {
  const lignes = await db.execute<{ heure: string; tickets: string; montant: string }>(sql`
    select extract(hour from v.encaissee_le at time zone 'Africa/Abidjan') as heure,
           count(*) as tickets, sum(v.total_ttc) as montant
    from ventes v
    where v.organization_id = ${organizationId} and v.statut = 'encaissee' and v.deleted_at is null
      and ${JOUR_VENTE} = ${jour}::date
    group by 1 order by 1
  `);
  return lignes.map((h) => ({ heure: Number(h.heure), tickets: Number(h.tickets), montant: Number(h.montant) }));
}

export interface ArticleVendu {
  designation: string;
  unite: CodeUnite;
  quantite: number;
  /** Chiffre TTC de l'article : ce que les clients ont payé pour lui. */
  montant: number;
  marge: number;
}

/** Les articles qui ont le plus rapporté entre deux jours inclus. */
export async function meilleuresVentes(organizationId: string, du: string, au: string, limite = 10): Promise<ArticleVendu[]> {
  const lignes = await db.execute<{ designation: string; unite: CodeUnite; quantite: string; montant: string; marge: string }>(sql`
    select coalesce(a.designation, min(lv.designation)) as designation, min(lv.unite) as unite,
           sum(lv.quantite) as quantite,
           sum(lv.montant_ht + lv.montant_tva) as montant,
           sum(lv.montant_ht) - round(sum(lv.quantite * lv.cout_unitaire)::numeric / 1000) - sum(lv.cout_main_oeuvre) as marge
    from lignes_vente lv
      join ventes v on v.id = lv.vente_id
      left join articles a on a.id = lv.article_id
    where v.organization_id = ${organizationId} and v.statut = 'encaissee' and v.deleted_at is null
      and ${JOUR_VENTE} between ${du}::date and ${au}::date
    group by lv.article_id, a.designation
    order by sum(lv.montant_ht + lv.montant_tva) desc
    limit ${limite}
  `);
  return lignes.map((l) => ({
    designation: l.designation,
    unite: l.unite,
    quantite: Number(l.quantite),
    montant: Number(l.montant),
    marge: Number(l.marge),
  }));
}

export interface VentesCaissier {
  caissier: string;
  tickets: number;
  montant: number;
}

export async function ventesParCaissier(organizationId: string, jour: string): Promise<VentesCaissier[]> {
  const lignes = await db.execute<{ caissier: string | null; tickets: string; montant: string }>(sql`
    select u.full_name as caissier, count(*) as tickets, sum(v.total_ttc) as montant
    from ventes v left join users u on u.id = v.user_id
    where v.organization_id = ${organizationId} and v.statut = 'encaissee' and v.deleted_at is null
      and ${JOUR_VENTE} = ${jour}::date
    group by u.full_name order by 3 desc
  `);
  return lignes.map((l) => ({ caissier: l.caissier ?? "Inconnu", tickets: Number(l.tickets), montant: Number(l.montant) }));
}

/** Nombre de familles d'articles : sans aucune, le catalogue de départ est proposé. */
export async function nombreDeFamilles(organizationId: string): Promise<number> {
  const [l] = await db.execute<{ n: string }>(sql`
    select count(*) as n from familles_article
    where organization_id = ${organizationId} and deleted_at is null
  `);
  return Number(l?.n ?? 0);
}
