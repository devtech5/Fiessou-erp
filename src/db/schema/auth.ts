import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { primaryId, rowVersion, timestamps } from "./_shared";
import { memberships } from "./tenancy";

export const userStatus = pgEnum("user_status", ["actif", "suspendu"]);

export const otpChannel = pgEnum("otp_channel", ["sms", "whatsapp", "email"]);

export const otpPurpose = pgEnum("otp_purpose", [
  "connexion",
  "inscription",
  "reinitialisation",
  "verification_telephone",
]);

/**
 * Compte de connexion.
 *
 * IMPORTANT — un utilisateur n'est PAS une personne métier.
 *
 * Trois natures de personnes coexistent dans Fiessou et ne doivent jamais être
 * confondues dans une seule table :
 *
 *   1. `users`      — celui qui ouvre le logiciel (compte, rôle, permissions)
 *   2. `employees`  — le salarié déclaré (contrat, bulletin, CNPS, ITS)
 *   3. `workers`    — l'intervenant : maçon, ferrailleur, manœuvre, tâcheron,
 *                     chauffeur occasionnel, serveur extra, coach…
 *                     Payé à la journée, à la tâche ou à l'unité d'œuvre.
 *
 * Un maçon sur un chantier n'ouvre jamais l'application et n'a pas de bulletin
 * de paie : il n'a donc ni ligne ici, ni ligne dans `employees`. Les tables 2
 * et 3 vivent dans le module RH et pointent vers `users` de façon optionnelle.
 *
 * L'identification se fait par téléphone : sur le marché visé, beaucoup
 * d'exploitants n'ont pas d'adresse e-mail active. L'e-mail reste facultatif.
 */
export const users = pgTable(
  "users",
  {
    id: primaryId(),
    /** Format E.164, indicatif compris : +2250700000000 */
    phone: text("phone").notNull(),
    email: text("email"),
    fullName: text("full_name").notNull(),

    /** Nul tant que le compte n'utilise que le code à usage unique. */
    passwordHash: text("password_hash"),

    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),

    locale: text("locale").notNull().default("fr"),
    status: userStatus("status").notNull().default("actif"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("users_phone_unique").on(t.phone),
    unique("users_email_unique").on(t.email),
  ],
);

/**
 * Session ouverte sur un appareil.
 *
 * `deviceId` est fourni par le client et reste stable d'une session à l'autre :
 * c'est lui qui porte le curseur de synchronisation hors connexion.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Entreprise active. Nulle tant que l'utilisateur n'en a pas choisi une. */
    organizationId: uuid("organization_id"),

    /** Seule l'empreinte du jeton est stockée, jamais le jeton lui-même. */
    tokenHash: text("token_hash").notNull(),

    deviceId: text("device_id"),
    deviceName: text("device_name"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),

    ...timestamps,
  },
  (t) => [
    unique("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_device_idx").on(t.deviceId),
  ],
);

/**
 * Codes à usage unique, envoyés par SMS ou WhatsApp.
 * Le code n'est jamais stocké en clair et le nombre de tentatives est plafonné.
 */
export const verificationCodes = pgTable(
  "verification_codes",
  {
    id: primaryId(),
    /** Numéro de téléphone ou adresse e-mail visé. */
    destination: text("destination").notNull(),
    channel: otpChannel("channel").notNull(),
    purpose: otpPurpose("purpose").notNull(),

    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),

    ...timestamps,
  },
  (t) => [index("verification_codes_destination_idx").on(t.destination, t.purpose)],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  memberships: many(memberships),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
