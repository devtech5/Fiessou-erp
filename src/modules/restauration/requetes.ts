import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { divideMoney } from "@/lib/money";
import type { CodeUnite } from "@/lib/quantite";
import { listerArticles } from "@/modules/catalogue/requetes";
import { stocksParArticle } from "@/modules/stock/requetes";
import { listerPostes, type PosteAvecDepot } from "@/modules/ventes/requetes";

import { totalCommande, type Espace, type Etat, type Poste } from "./calcul";
import { commandesSalle, lignesCommandeSalle, tablesSalle, type TableSalle } from "./schema";

export async function tablesDeLEspace(organizationId: string, espace: Espace, inclureRetirees = false): Promise<TableSalle[]> {
  const filtres = [eq(tablesSalle.organizationId, organizationId), eq(tablesSalle.espace, espace), isNull(tablesSalle.deletedAt)];
  if (!inclureRetirees) filtres.push(eq(tablesSalle.actif, true));
  return db
    .select()
    .from(tablesSalle)
    .where(and(...filtres))
    .orderBy(asc(tablesSalle.ordre), asc(tablesSalle.zone), asc(tablesSalle.nom));
}

export interface CommandeEnCours {
  id: string;
  numero: string;
  tableId: string | null;
  libelle: string | null;
  couverts: number | null;
  serveur: string | null;
  ouverteLe: Date;
  total: number;
  lignesEnPreparation: number;
  lignesPretes: number;
}

/**
 * Commandes ouvertes de l'espace, avec ce que la table doit et ce qui attend
 * d'être porté. Une seule requête : le plan de salle se rafraîchit pendant le
 * service, il ne doit pas en faire une par table.
 */
export async function commandesEnCours(organizationId: string, espace: Espace): Promise<CommandeEnCours[]> {
  const lignes = await db.execute<{
    id: string;
    numero: string;
    table_id: string | null;
    libelle: string | null;
    couverts: number | null;
    serveur: string | null;
    ouverte_le: string | Date;
    total: string;
    en_preparation: string;
    pretes: string;
  }>(sql`
    select c.id, c.numero, c.table_id, c.libelle, c.couverts, u.full_name as serveur, c.ouverte_le,
      coalesce(sum(round(l.prix_unitaire * l.quantite / 1000::numeric)) filter (where l.etat <> 'annulee'), 0) as total,
      count(l.id) filter (where l.etat = 'envoyee') as en_preparation,
      count(l.id) filter (where l.etat = 'prete') as pretes
    from commandes_salle c
      left join lignes_commande_salle l on l.commande_id = c.id
      left join users u on u.id = c.serveur_id
    where c.organization_id = ${organizationId} and c.espace = ${espace}
      and c.statut = 'ouverte' and c.deleted_at is null
    group by c.id, u.full_name
    order by c.ouverte_le
  `);

  return lignes.map((l) => ({
    id: l.id,
    numero: l.numero,
    tableId: l.table_id,
    libelle: l.libelle,
    couverts: l.couverts === null ? null : Number(l.couverts),
    serveur: l.serveur,
    ouverteLe: new Date(l.ouverte_le),
    total: Number(l.total),
    lignesEnPreparation: Number(l.en_preparation),
    lignesPretes: Number(l.pretes),
  }));
}

export interface LigneCommandeVue {
  id: string;
  articleId: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  note: string | null;
  poste: Poste;
  etat: Etat;
  envoyeeLe: Date;
  motifAnnulation: string | null;
}

export interface CommandeDetaillee {
  id: string;
  espace: Espace;
  numero: string;
  statut: "ouverte" | "encaissee" | "annulee";
  tableId: string | null;
  tableNom: string | null;
  libelle: string | null;
  couverts: number | null;
  serveur: string | null;
  ouverteLe: Date;
  closeLe: Date | null;
  venteId: string | null;
  motifAnnulation: string | null;
  lignes: LigneCommandeVue[];
  total: number;
}

export async function commandeDetaillee(organizationId: string, commandeId: string): Promise<CommandeDetaillee | null> {
  const [commande] = await db
    .select({ commande: commandesSalle, tableNom: tablesSalle.nom, serveur: users.fullName })
    .from(commandesSalle)
    .leftJoin(tablesSalle, eq(tablesSalle.id, commandesSalle.tableId))
    .leftJoin(users, eq(users.id, commandesSalle.serveurId))
    .where(and(eq(commandesSalle.id, commandeId), eq(commandesSalle.organizationId, organizationId), isNull(commandesSalle.deletedAt)));
  if (!commande) return null;

  const lignes = await db
    .select({
      id: lignesCommandeSalle.id,
      articleId: lignesCommandeSalle.articleId,
      designation: lignesCommandeSalle.designation,
      quantite: lignesCommandeSalle.quantite,
      prixUnitaire: lignesCommandeSalle.prixUnitaire,
      note: lignesCommandeSalle.note,
      poste: lignesCommandeSalle.poste,
      etat: lignesCommandeSalle.etat,
      envoyeeLe: lignesCommandeSalle.envoyeeLe,
      motifAnnulation: lignesCommandeSalle.motifAnnulation,
    })
    .from(lignesCommandeSalle)
    .where(eq(lignesCommandeSalle.commandeId, commandeId))
    .orderBy(asc(lignesCommandeSalle.ordre));

  const c = commande.commande;
  return {
    id: c.id,
    espace: c.espace,
    numero: c.numero,
    statut: c.statut,
    tableId: c.tableId,
    tableNom: commande.tableNom,
    libelle: c.libelle,
    couverts: c.couverts,
    serveur: commande.serveur,
    ouverteLe: c.ouverteLe,
    closeLe: c.closeLe,
    venteId: c.venteId,
    motifAnnulation: c.motifAnnulation,
    lignes,
    total: totalCommande(lignes),
  };
}

export interface BonProduction {
  commandeId: string;
  numero: string;
  /** Table, ou nom du client à emporter. */
  repere: string;
  lignes: {
    id: string;
    designation: string;
    quantite: number;
    unite: CodeUnite;
    note: string | null;
    poste: Poste;
    etat: "envoyee" | "prete";
    envoyeeLe: Date;
  }[];
}

/**
 * Ce que la cuisine et le bar ont à préparer, et ce qui attend le serveur.
 *
 * Groupé par commande, dans l'ordre d'envoi : le premier bon arrivé est le
 * premier servi. Une commande déjà encaissée y reste tant que ses plats ne sont
 * pas sortis — au maquis, on paie souvent avant d'être servi.
 */
export async function bonsDeProduction(organizationId: string, espace: Espace, poste?: Poste): Promise<BonProduction[]> {
  const lignes = await db.execute<{
    id: string;
    commande_id: string;
    numero: string;
    table_nom: string | null;
    libelle: string | null;
    designation: string;
    quantite: string;
    unite: CodeUnite;
    note: string | null;
    poste: Poste;
    etat: "envoyee" | "prete";
    envoyee_le: string | Date;
  }>(sql`
    select l.id, l.commande_id, c.numero, t.nom as table_nom, c.libelle, l.designation, l.quantite, a.unite, l.note, l.poste, l.etat, l.envoyee_le
    from lignes_commande_salle l
      join commandes_salle c on c.id = l.commande_id
      join articles a on a.id = l.article_id
      left join tables_salle t on t.id = c.table_id
    where l.organization_id = ${organizationId} and c.espace = ${espace}
      and c.statut <> 'annulee' and c.deleted_at is null
      and l.etat in ('envoyee', 'prete')
      ${poste ? sql`and l.poste = ${poste}` : sql``}
    order by l.envoyee_le, l.ordre
  `);

  const bons = new Map<string, BonProduction>();
  for (const l of lignes) {
    const bon = bons.get(l.commande_id) ?? {
      commandeId: l.commande_id,
      numero: l.numero,
      repere: l.table_nom ? `Table ${l.table_nom}` : (l.libelle ?? "À emporter"),
      lignes: [],
    };
    bon.lignes.push({
      id: l.id,
      designation: l.designation,
      quantite: Number(l.quantite),
      unite: l.unite,
      note: l.note,
      poste: l.poste,
      etat: l.etat,
      envoyeeLe: new Date(l.envoyee_le),
    });
    bons.set(l.commande_id, bon);
  }
  return [...bons.values()];
}

/**
 * Espace d'une commande, d'une ligne ou d'une table.
 *
 * Les droits se vérifient par espace : un serveur du maquis qui n'a pas le
 * restaurant ne doit pas pouvoir agir sur une table du restaurant en passant
 * par les écrans du maquis.
 */
export async function espaceDe(
  organizationId: string,
  cible: { commandeId: string } | { ligneId: string } | { tableId: string },
): Promise<Espace | null> {
  if ("tableId" in cible) {
    const [t] = await db
      .select({ espace: tablesSalle.espace })
      .from(tablesSalle)
      .where(and(eq(tablesSalle.id, cible.tableId), eq(tablesSalle.organizationId, organizationId)));
    return t?.espace ?? null;
  }
  if ("ligneId" in cible) {
    const [l] = await db
      .select({ espace: commandesSalle.espace })
      .from(lignesCommandeSalle)
      .innerJoin(commandesSalle, eq(commandesSalle.id, lignesCommandeSalle.commandeId))
      .where(and(eq(lignesCommandeSalle.id, cible.ligneId), eq(lignesCommandeSalle.organizationId, organizationId)));
    return l?.espace ?? null;
  }
  const [c] = await db
    .select({ espace: commandesSalle.espace })
    .from(commandesSalle)
    .where(and(eq(commandesSalle.id, cible.commandeId), eq(commandesSalle.organizationId, organizationId)));
  return c?.espace ?? null;
}

/** Postes qui encaissent la salle : numérotés par le serveur. */
export async function postesDeSalle(organizationId: string): Promise<PosteAvecDepot[]> {
  return (await listerPostes(organizationId)).filter((poste) => poste.numerotation === "serveur");
}

export interface ArticleCarte {
  id: string;
  designation: string;
  categorie: string;
  /** Prix TTC d'une unité, en francs. */
  prix: number;
  unite: CodeUnite;
  /** Sans stock suivi : un plat, une prestation. */
  service: boolean;
  /** Stock total, en millièmes. Nul pour un service. */
  stock: number | null;
}

/** La carte telle que le serveur la voit : ce qui se vend, rangé par famille. */
export async function carte(organizationId: string): Promise<ArticleCarte[]> {
  const [catalogue, stocks] = await Promise.all([listerArticles(organizationId), stocksParArticle(organizationId)]);
  return catalogue.map((article) => ({
    id: article.id,
    designation: article.designation,
    categorie: article.familleNom ?? "Divers",
    prix: article.prixVente,
    unite: article.unite,
    service: !article.suiviStock,
    stock: article.suiviStock ? (stocks.get(article.id)?.quantite ?? 0) : null,
  }));
}

export interface JourneeSalle {
  commandesEncaissees: number;
  chiffreAffaires: number;
  couverts: number;
  /** Ce que rapporte une table encaissée, en moyenne. */
  ticketMoyen: number;
  annulees: number;
}

/** Chiffres du service depuis `depuis` : la soirée, ou la journée. */
export async function journeeSalle(organizationId: string, espace: Espace, depuis: Date): Promise<JourneeSalle> {
  const seuil = depuis.toISOString();
  const [ligne] = await db.execute<{ encaissees: string; chiffre: string; couverts: string; annulees: string }>(sql`
    select
      count(*) filter (where c.statut = 'encaissee') as encaissees,
      coalesce(sum(v.total_ttc) filter (where c.statut = 'encaissee' and v.statut = 'encaissee'), 0) as chiffre,
      coalesce(sum(c.couverts) filter (where c.statut = 'encaissee'), 0) as couverts,
      count(*) filter (where c.statut = 'annulee') as annulees
    from commandes_salle c
      left join ventes v on v.id = c.vente_id
    where c.organization_id = ${organizationId} and c.espace = ${espace}
      and c.deleted_at is null and c.close_le >= ${seuil}
  `);

  const commandesEncaissees = Number(ligne?.encaissees ?? 0);
  const chiffreAffaires = Number(ligne?.chiffre ?? 0);
  return {
    commandesEncaissees,
    chiffreAffaires,
    couverts: Number(ligne?.couverts ?? 0),
    ticketMoyen: divideMoney(chiffreAffaires, commandesEncaissees),
    annulees: Number(ligne?.annulees ?? 0),
  };
}
