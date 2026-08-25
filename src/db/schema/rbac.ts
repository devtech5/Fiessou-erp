import { relations } from "drizzle-orm";
import { boolean, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";

import { primaryId, timestamps } from "./_shared";

/**
 * Rôle. Un rôle système (organizationId nul) est fourni par Fiessou et
 * disponible pour toutes les entreprises. Une entreprise peut en créer
 * d'autres, qui n'appartiennent qu'à elle.
 */
export const roles = pgTable(
  "roles",
  {
    id: primaryId(),
    organizationId: uuid("organization_id"),
    /** proprietaire, gerant, caissier, comptable, magasinier… */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (t) => [unique("roles_org_key_unique").on(t.organizationId, t.key)],
);

/**
 * Catalogue des permissions. Alimenté par le code, pas par l'utilisateur :
 * chaque module déclare les siennes au format `module.ressource.action`,
 * par exemple `pos.session.ouvrir` ou `stock.inventaire.valider`.
 */
export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  moduleKey: text("module_key").notNull(),
  label: text("label").notNull(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
);

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionKey],
    references: [permissions.key],
  }),
}));
