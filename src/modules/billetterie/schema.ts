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

import { money, primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";

/**
 * Ligne desservie : un trajet et son tarif.
 *
 * À ne pas confondre avec la livraison. La billetterie réserve UNE PLACE SUR
 * UN DÉPART PROGRAMMÉ ; la livraison suit UN OBJET d'un point à un autre. Ici
 * la ressource est un siège qui n'existe qu'à une date et une heure données.
 */
export const lignesTransport = pgTable(
  "lignes_transport",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** ABJ-BKE : ce que la gare affiche au-dessus du quai. */
    code: text("code").notNull(),
    depart: text("depart").notNull(),
    arrivee: text("arrivee").notNull(),
    /** Durée annoncée, en minutes. */
    dureeMinutes: integer("duree_minutes").notNull(),
    distanceKm: integer("distance_km"),
    /** Tarif TTC d'une place, en francs entiers. */
    tarif: money("tarif").notNull(),
    /**
     * Points de base : 1800 = 18 %. Le régime du transport de voyageurs se
     * vérifie avec le conseil fiscal de l'exploitant : le taux vit sur la
     * ligne, pas dans le code.
     */
    tauxTva: integer("taux_tva").notNull().default(1800),
    active: boolean("active").notNull().default(true),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("lignes_transport_code_unique").on(t.organizationId, t.code),
    check("lignes_transport_tarif", sql`${t.tarif} >= 0 AND ${t.dureeMinutes} > 0`),
  ],
);

/**
 * Statut d'un départ. « Complet » n'en est pas un : c'est un départ ouvert
 * dont toutes les places sont vendues, et la base le compte à la lecture.
 */
export const statutDepart = pgEnum("statut_depart", ["ouvert", "embarquement", "parti", "annule"]);

/**
 * Départ programmé : une ligne, une date, une heure, un véhicule.
 *
 * Le tarif est FIGÉ à la programmation : changer la grille de la ligne ne
 * modifie pas le prix d'un départ déjà en vente, ni celui des billets émis.
 */
export const departs = pgTable(
  "departs",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    reference: text("reference").notNull(),
    ligneId: uuid("ligne_id")
      .notNull()
      .references(() => lignesTransport.id, { onDelete: "restrict" }),
    partLe: timestamp("part_le", { withTimezone: true }).notNull(),
    vehicule: text("vehicule").notNull(),
    /** Rangées de quatre sièges, disposition 2 + couloir + 2. */
    rangees: integer("rangees").notNull(),
    tarif: money("tarif").notNull(),
    tauxTva: integer("taux_tva").notNull(),

    statut: statutDepart("statut").notNull().default("ouvert"),
    motif: text("motif"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("departs_reference_unique").on(t.organizationId, t.reference),
    check("departs_rangees", sql`${t.rangees} BETWEEN 1 AND 30`),
    check("departs_annulation_motivee", sql`${t.statut} <> 'annule' OR ${t.motif} IS NOT NULL`),
    index("departs_org_idx").on(t.organizationId, t.partLe),
  ],
);

export const statutBillet = pgEnum("statut_billet", ["valide", "embarque", "annule", "non_presente"]);

export const canalBillet = pgEnum("canal_billet", ["guichet", "en_ligne"]);

export const moyenBillet = pgEnum("moyen_billet", ["especes", "mobile_money", "banque"]);

/**
 * Billet : nominatif, il porte son siège. C'est ce couple qui se contrôle à
 * la montée.
 *
 * L'index unique partiel sur (départ, siège) hors billets annulés est la vraie
 * garde contre la double vente : deux guichets qui vendent le 4A au même
 * instant, la base en refuse un, quoi que l'écran ait affiché.
 */
export const billets = pgTable(
  "billets",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    numero: text("numero").notNull(),
    departId: uuid("depart_id")
      .notNull()
      .references(() => departs.id, { onDelete: "restrict" }),
    siege: text("siege").notNull(),

    passager: text("passager").notNull(),
    telephone: text("telephone"),
    /** Pièce d'identité relevée à la vente, exigée au contrôle. */
    piece: text("piece"),

    montant: money("montant").notNull(),
    canal: canalBillet("canal").notNull().default("guichet"),
    moyen: moyenBillet("moyen").notNull().default("especes"),
    statut: statutBillet("statut").notNull().default("valide"),

    ecriture: text("ecriture"),
    ecritureAnnulation: text("ecriture_annulation"),
    embarqueLe: timestamp("embarque_le", { withTimezone: true }),
    motif: text("motif"),
    userId: uuid("user_id"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("billets_numero_unique").on(t.organizationId, t.numero),
    uniqueIndex("billets_siege_unique")
      .on(t.departId, t.siege)
      .where(sql`${t.statut} <> 'annule'`),
    check("billets_montant", sql`${t.montant} >= 0`),
    check("billets_annulation_motivee", sql`${t.statut} <> 'annule' OR ${t.motif} IS NOT NULL`),
    index("billets_depart_idx").on(t.departId, t.statut),
  ],
);

export type LigneTransport = typeof lignesTransport.$inferSelect;
export type Depart = typeof departs.$inferSelect;
export type StatutDepart = Depart["statut"];
export type Billet = typeof billets.$inferSelect;
export type StatutBillet = Billet["statut"];
export type MoyenBillet = Billet["moyen"];
export type CanalBillet = Billet["canal"];
