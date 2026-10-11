import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { money, primaryId, quantity, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { articles } from "@/modules/catalogue/schema";
import { ventes } from "@/modules/ventes/schema";

/**
 * Restauration : le moteur commun au restaurant et au maquis.
 *
 * Deux modules au registre, facturés à part, un seul moteur. Ce qui les
 * distingue tient au vocabulaire et aux habitudes du terrain — couverts au
 * restaurant, tournées au maquis —, pas à la donnée : une table, une commande
 * ouverte, des lignes envoyées en cuisine ou au bar, un encaissement.
 * `espace` sépare les deux salles d'une entreprise qui tient les deux.
 *
 * La commande n'écrit RIEN en comptabilité ni en stock. Tout passe par la
 * vente qui l'encaisse (`enregistrerVenteDans`) : une seule voie d'écriture,
 * sans quoi la bière sortirait du stock une fois à la commande et une fois au
 * ticket.
 */

export const espaceRestauration = pgEnum("espace_restauration", ["restaurant", "maquis"]);

/** Où se prépare une ligne : le plat part en cuisine, la boisson au bar. */
export const posteProduction = pgEnum("poste_production", ["cuisine", "bar"]);

export const statutCommandeSalle = pgEnum("statut_commande_salle", ["ouverte", "encaissee", "annulee"]);

/**
 * État d'une ligne. Une ligne naît ENVOYÉE : elle n'existe en base qu'une fois
 * partie en cuisine. Ce que le serveur compose avant d'envoyer reste sur son
 * appareil, et ne se facture pas.
 */
export const etatPreparation = pgEnum("etat_preparation", ["envoyee", "prete", "servie", "annulee"]);

/**
 * Table de la salle, de la terrasse ou de l'espace VIP.
 *
 * Une table désactivée sort du plan de salle mais reste attachée à ses
 * commandes passées : on ne réécrit pas l'histoire d'une soirée parce que la
 * terrasse a été réaménagée.
 */
export const tablesSalle = pgTable(
  "tables_salle",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    espace: espaceRestauration("espace").notNull(),

    nom: text("nom").notNull(),
    /** Salle, terrasse, VIP, comptoir : regroupe les tables sur le plan. */
    zone: text("zone"),
    places: integer("places"),
    ordre: integer("ordre").notNull().default(0),
    actif: boolean("actif").notNull().default(true),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("tables_salle_nom_unique").on(t.organizationId, t.espace, t.nom),
    check("tables_salle_places", sql`${t.places} IS NULL OR ${t.places} BETWEEN 1 AND 500`),
    index("tables_salle_org_idx").on(t.organizationId, t.espace, t.actif),
  ],
);

/**
 * Commande de salle : ce qu'une table a consommé, de l'ouverture à
 * l'encaissement.
 *
 * Numérotée à l'ouverture, dans la transaction qui la crée : « CMD-2026-00042 »
 * se lit sur le bon de cuisine et sur l'écran du serveur, avant tout ticket.
 * Le ticket de caisse, lui, porte son propre numéro — celui du poste qui
 * encaisse.
 */
export const commandesSalle = pgTable(
  "commandes_salle",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    espace: espaceRestauration("espace").notNull(),

    numero: text("numero").notNull(),
    /** Nulle pour une commande à emporter. */
    tableId: uuid("table_id").references(() => tablesSalle.id, { onDelete: "restrict" }),
    /** Nom du client ou repère d'une commande à emporter : « Awa, moto rouge ». */
    libelle: text("libelle"),
    couverts: integer("couverts"),
    /** Compte du serveur qui tient la table. */
    serveurId: uuid("serveur_id"),

    statut: statutCommandeSalle("statut").notNull().default("ouverte"),
    ouverteLe: timestamp("ouverte_le", { withTimezone: true }).notNull().defaultNow(),
    closeLe: timestamp("close_le", { withTimezone: true }),

    /** Vente qui l'a encaissée. C'est elle qui porte stock et écriture. */
    venteId: uuid("vente_id").references(() => ventes.id, { onDelete: "restrict" }),
    motifAnnulation: text("motif_annulation"),
    notes: text("notes"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("commandes_salle_numero_unique").on(t.organizationId, t.numero),
    check("commandes_salle_couverts", sql`${t.couverts} IS NULL OR ${t.couverts} BETWEEN 1 AND 500`),
    check(
      "commandes_salle_annulation_motivee",
      sql`${t.statut} <> 'annulee' OR ${t.motifAnnulation} IS NOT NULL`,
    ),
    check("commandes_salle_encaissee_a_sa_vente", sql`${t.statut} <> 'encaissee' OR ${t.venteId} IS NOT NULL`),
    /**
     * Une table n'a qu'une commande ouverte à la fois. Deux serveurs qui
     * ouvrent la même table au même instant : le second est refusé en base,
     * plutôt que de laisser deux additions se partager une soirée.
     */
    uniqueIndex("commandes_salle_une_ouverte_par_table")
      .on(t.tableId)
      .where(sql`${t.statut} = 'ouverte' AND ${t.tableId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    index("commandes_salle_org_idx").on(t.organizationId, t.espace, t.statut),
    index("commandes_salle_vente_idx").on(t.venteId),
  ],
);

/**
 * Ligne de commande.
 *
 * Désignation et prix RECOPIÉS depuis l'article à l'envoi, comme sur une
 * ligne de vente : le prix annoncé au client à 20 h est celui qu'il paie à
 * 23 h, même si la carte change entre-temps.
 *
 * Une ligne ne se modifie pas : elle s'annule et une autre la remplace. Le
 * plat envoyé puis annulé reste visible, avec son motif — c'est ce que le
 * gérant cherche quand la cuisine et la caisse ne tombent pas d'accord.
 */
export const lignesCommandeSalle = pgTable(
  "lignes_commande_salle",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    commandeId: uuid("commande_id")
      .notNull()
      .references(() => commandesSalle.id, { onDelete: "cascade" }),

    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    designation: text("designation").notNull(),
    /** En millièmes d'unité : le poisson braisé se vend au kilo. */
    quantite: quantity("quantite").notNull(),
    /** Prix TTC d'une unité, en francs entiers, tel qu'annoncé à l'envoi. */
    prixUnitaire: money("prix_unitaire").notNull().default(0),
    /** « Sans piment », « bien cuit », « glacée ». */
    note: text("note"),

    poste: posteProduction("poste").notNull().default("cuisine"),
    etat: etatPreparation("etat").notNull().default("envoyee"),
    envoyeeLe: timestamp("envoyee_le", { withTimezone: true }).notNull().defaultNow(),
    preteLe: timestamp("prete_le", { withTimezone: true }),
    servieLe: timestamp("servie_le", { withTimezone: true }),
    motifAnnulation: text("motif_annulation"),

    /** Compte qui a envoyé la ligne. */
    userId: uuid("user_id"),
    ordre: integer("ordre").notNull().default(0),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    check("lignes_commande_salle_quantite", sql`${t.quantite} > 0`),
    check("lignes_commande_salle_prix", sql`${t.prixUnitaire} >= 0`),
    index("lignes_commande_salle_commande_idx").on(t.commandeId, t.ordre),
    index("lignes_commande_salle_production_idx").on(t.organizationId, t.etat, t.poste),
  ],
);

export type TableSalle = typeof tablesSalle.$inferSelect;
export type CommandeSalle = typeof commandesSalle.$inferSelect;
export type LigneCommandeSalle = typeof lignesCommandeSalle.$inferSelect;
export type EspaceRestauration = CommandeSalle["espace"];
export type PosteProduction = LigneCommandeSalle["poste"];
export type EtatPreparation = LigneCommandeSalle["etat"];
