import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { missions } from "@/modules/missions/schema";
import { projets } from "@/modules/projets/schema";

import type { QuestionEnquete, Valeurs } from "./calcul";

/**
 * Enquêtes et satisfaction.
 *
 * Une enquête est un questionnaire et ses réponses : satisfaction des clients
 * d'un chantier, recensement d'un quartier, sondage avant l'ouverture d'une
 * boutique. Elle se rattache à un projet — c'est lui qui la commande et qui en
 * lit les résultats — et se remplit de deux façons :
 *
 *   · sur le terrain, par un enquêteur, éventuellement au cours d'une mission,
 *     avec la position de l'appareil ;
 *   · par le répondant lui-même, sur un lien public signé envoyé par WhatsApp
 *     ou par e-mail, sans compte.
 *
 * Les questions se figent à la première réponse : changer une question après
 * coup changerait le sens des réponses déjà reçues.
 */

export const statutEnquete = pgEnum("statut_enquete", ["brouillon", "ouverte", "close"]);
export const canalReponse = pgEnum("canal_reponse", ["terrain", "lien"]);

export const enquetes = pgTable(
  "enquetes",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    numero: text("numero").notNull(),
    titre: text("titre").notNull(),
    /** Texte d'accueil du répondant : qui demande, pourquoi, combien de temps. */
    introduction: text("introduction"),
    projetId: uuid("projet_id").references(() => projets.id, { onDelete: "set null" }),

    questions: jsonb("questions").$type<QuestionEnquete[]>().notNull(),
    statut: statutEnquete("statut").notNull().default("brouillon"),
    /** Le lien public répond-il ? Un lien se coupe sans fermer l'enquête de terrain. */
    lienPublic: boolean("lien_public").notNull().default(true),
    /** Objectif de réponses, pour le suivi de la collecte. */
    objectif: integer("objectif"),

    ouverteLe: timestamp("ouverte_le", { withTimezone: true }),
    closeLe: timestamp("close_le", { withTimezone: true }),
    userId: uuid("user_id"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("enquetes_numero_unique").on(t.organizationId, t.numero),
    check("enquetes_questions_tableau", sql`jsonb_typeof(${t.questions}) = 'array'`),
    check("enquetes_objectif", sql`${t.objectif} IS NULL OR ${t.objectif} BETWEEN 1 AND 1000000`),
    index("enquetes_org_idx").on(t.organizationId, t.statut),
    index("enquetes_projet_idx").on(t.projetId),
  ],
);

/**
 * Réponse à une enquête.
 *
 * L'identifiant vient de l'appareil : une réponse saisie sans réseau au fond
 * d'un village garde son identité, et un renvoi ne la double pas.
 */
export const reponsesEnquete = pgTable(
  "reponses_enquete",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    enqueteId: uuid("enquete_id")
      .notNull()
      .references(() => enquetes.id, { onDelete: "cascade" }),

    canal: canalReponse("canal").notNull(),
    valeurs: jsonb("valeurs").$type<Valeurs>().notNull(),
    /** Nom ou téléphone du répondant, s'il accepte de le donner. */
    repondant: text("repondant"),

    /** Enquêteur, pour une réponse de terrain. */
    userId: uuid("user_id"),
    missionId: uuid("mission_id").references(() => missions.id, { onDelete: "set null" }),
    /** Position en micro-degrés, comme les preuves de mission. */
    latitudeMicro: integer("latitude_micro"),
    longitudeMicro: integer("longitude_micro"),

    priseLe: timestamp("prise_le", { withTimezone: true }).notNull(),
    recueLe: timestamp("recue_le", { withTimezone: true }).notNull().defaultNow(),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    check("reponses_enquete_valeurs_objet", sql`jsonb_typeof(${t.valeurs}) = 'object'`),
    check(
      "reponses_enquete_position_bornee",
      sql`(${t.latitudeMicro} IS NULL OR ${t.latitudeMicro} BETWEEN -90000000 AND 90000000)
        AND (${t.longitudeMicro} IS NULL OR ${t.longitudeMicro} BETWEEN -180000000 AND 180000000)`,
    ),
    index("reponses_enquete_enquete_idx").on(t.enqueteId, t.priseLe),
    index("reponses_enquete_org_idx").on(t.organizationId),
  ],
);

export type Enquete = typeof enquetes.$inferSelect;
export type ReponseEnquete = typeof reponsesEnquete.$inferSelect;
export type StatutEnquete = Enquete["statut"];
