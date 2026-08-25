import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { primaryId, timestamps } from "./_shared";
import { organizations } from "./tenancy";

/**
 * Journal des actions sensibles : qui a fait quoi, quand, depuis où.
 *
 * À ne pas confondre avec `change_log`, qui sert à la réplication vers les
 * appareils. Celui-ci répond à une question humaine — « qui a annulé ce
 * ticket ? », « qui a modifié ce prix ? » — et ne s'efface jamais.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: primaryId(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /** Nul pour une action automatique du système. */
    userId: uuid("user_id"),

    /** Verbe métier : `vente.annuler`, `prix.modifier`, `session.cloturer`. */
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),

    /** États avant et après, pour pouvoir expliquer un écart. */
    before: jsonb("before"),
    after: jsonb("after"),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    ...timestamps,
  },
  (t) => [
    index("audit_logs_org_idx").on(t.organizationId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);
