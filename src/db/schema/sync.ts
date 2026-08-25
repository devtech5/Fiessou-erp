import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { primaryId, timestamps } from "./_shared";
import { organizations } from "./tenancy";

export const mutationOperation = pgEnum("mutation_operation", [
  "creer",
  "modifier",
  "supprimer",
]);

export const mutationStatus = pgEnum("mutation_status", [
  "en_attente",
  "appliquee",
  "rejetee",
  "conflit",
]);

/**
 * Mutations remontées par un appareil après une période hors connexion.
 *
 * L'identifiant est produit par le client. C'est ce qui rend l'envoi
 * idempotent : un réseau instable fait renvoyer le même lot plusieurs fois, et
 * seule la première insertion compte. Une vente ne peut pas être encaissée deux
 * fois parce que la connexion a coupé au mauvais moment.
 *
 * Le journal est conservé après application : c'est la seule trace de ce qui
 * s'est passé sur un appareil déconnecté.
 */
export const syncMutations = pgTable(
  "sync_mutations",
  {
    /** Fourni par le client, pas par la base. */
    id: uuid("id").primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    deviceId: text("device_id").notNull(),

    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    operation: mutationOperation("operation").notNull(),
    payload: jsonb("payload").notNull(),

    /** Rang de la mutation dans la file locale de l'appareil : préserve l'ordre. */
    clientSeq: integer("client_seq").notNull(),
    /** Heure de l'appareil — peut être fausse, ne jamais s'en servir pour arbitrer. */
    clientCreatedAt: timestamp("client_created_at", { withTimezone: true }).notNull(),

    /** Version de la ligne que l'appareil croyait détenir, pour détecter un conflit. */
    baseVersion: integer("base_version"),

    status: mutationStatus("status").notNull().default("en_attente"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    error: text("error"),

    ...timestamps,
  },
  (t) => [
    index("sync_mutations_device_idx").on(t.deviceId, t.clientSeq),
    index("sync_mutations_entity_idx").on(t.entityType, t.entityId),
  ],
);

/**
 * Journal serveur des changements, strictement ordonné.
 *
 * Un appareil qui se reconnecte demande « tout ce qui a changé depuis le rang
 * N » et rejoue la suite. `seq` est un compteur global croissant : c'est lui
 * qui garantit qu'aucun changement n'est sauté, même si les horloges des
 * appareils sont décalées.
 *
 * Sert aussi d'historique pour l'analyse : sans ce journal, impossible de dire
 * comment un prix ou un stock a évolué, seulement où il en est aujourd'hui.
 */
export const changeLog = pgTable(
  "change_log",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    operation: mutationOperation("operation").notNull(),
    version: integer("version").notNull(),

    /** Appareil à l'origine du changement : évite de le lui renvoyer en écho. */
    originDeviceId: text("origin_device_id"),
    userId: uuid("user_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("change_log_org_seq_idx").on(t.organizationId, t.seq),
    index("change_log_entity_idx").on(t.entityType, t.entityId),
  ],
);

/** Où en est chaque appareil dans le journal ci-dessus. */
export const syncCursors = pgTable(
  "sync_cursors",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    userId: uuid("user_id"),

    lastSeq: integer("last_seq").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    ...timestamps,
  },
  (t) => [unique("sync_cursors_unique").on(t.organizationId, t.deviceId)],
);
