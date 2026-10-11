import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";

/**
 * Sécurité : les sites surveillés et leurs caméras.
 *
 * Un site est un lieu qui a son enregistreur — un magasin, un entrepôt, un
 * bureau — et son relais. Une caméra est un canal de cet enregistreur.
 * Aucune image ne passe par la base : elle ne garde que de quoi retrouver le
 * flux et autoriser qui le regarde.
 */

export const natureSite = pgEnum("nature_site_securite", ["magasin", "entrepot", "bureau", "autre"]);
export const marqueEnregistreur = pgEnum("marque_enregistreur", ["hikvision", "dahua"]);

export const sitesSecurite = pgTable(
  "sites_securite",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    nom: text("nom").notNull(),
    nature: natureSite("nature").notNull().default("magasin"),
    adresse: text("adresse"),

    marque: marqueEnregistreur("marque").notNull().default("hikvision"),
    /** Adresse de l'enregistreur sur le réseau du site, telle que le relais la joint : 192.168.1.64. */
    enregistreurAdresse: text("enregistreur_adresse").notNull(),
    enregistreurPort: integer("enregistreur_port").notNull().default(554),

    /** Empreinte SHA-256 de la clé du relais. La clé elle-même n'est montrée qu'une fois. */
    relaisEmpreinte: text("relais_empreinte"),
    /** Dernière publication acceptée : c'est ce qui dit si le relais tourne. */
    relaisVuLe: timestamp("relais_vu_le", { withTimezone: true }),

    actif: boolean("actif").notNull().default(true),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("sites_securite_nom_unique").on(t.organizationId, t.nom),
    check("sites_securite_port", sql`${t.enregistreurPort} BETWEEN 1 AND 65535`),
    index("sites_securite_org_idx").on(t.organizationId, t.actif),
  ],
);

export const cameras = pgTable(
  "cameras",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sitesSecurite.id, { onDelete: "cascade" }),

    nom: text("nom").notNull(),
    /** Ce qu'elle filme : caisse, entrée, quai de chargement, réserve. */
    emplacement: text("emplacement"),
    /** Canal de l'enregistreur, à partir de 1. */
    canal: integer("canal").notNull(),
    /** Publier aussi le flux principal, pour le plein écran. */
    hd: boolean("hd").notNull().default(false),
    ordre: integer("ordre").notNull().default(0),
    actif: boolean("actif").notNull().default(true),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("cameras_canal_unique").on(t.siteId, t.canal),
    check("cameras_canal", sql`${t.canal} BETWEEN 1 AND 256`),
    index("cameras_site_idx").on(t.organizationId, t.siteId, t.ordre),
  ],
);

export type SiteSecurite = typeof sitesSecurite.$inferSelect;
export type Camera = typeof cameras.$inferSelect;
