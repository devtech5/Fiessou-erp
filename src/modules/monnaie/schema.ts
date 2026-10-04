import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { money, primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";

/**
 * Guichet de monnaie électronique : transfert d'argent et vente de crédit.
 *
 * Un guichet manipule DEUX réserves à la fois :
 *
 *   · le float — la monnaie électronique disponible chez chaque opérateur ;
 *   · les espèces — le liquide dans le tiroir.
 *
 * Un dépôt client fait passer de la valeur du float vers les espèces, un
 * retrait fait l'inverse. La somme des deux ne bouge pas : c'est cet
 * invariant qui permet le rapprochement du soir.
 */
export const reseauMonnaie = pgEnum("reseau_monnaie", ["wave", "orange", "mtn", "moov"]);

/**
 * Session de guichet : de l'ouverture (fond de caisse et floats comptés) à la
 * clôture (tiroir compté, soldes relevés chez chaque opérateur).
 *
 * Une seule session ouverte par entreprise : deux sessions en parallèle se
 * partageraient le même tiroir et aucune ne pourrait rapprocher.
 */
export const statutSessionGuichet = pgEnum("statut_session_guichet", ["ouverte", "cloturee"]);

export const sessionsGuichet = pgTable(
  "sessions_guichet",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    numero: text("numero").notNull(),
    statut: statutSessionGuichet("statut").notNull().default("ouverte"),
    ouverteLe: timestamp("ouverte_le", { withTimezone: true }).notNull().defaultNow(),
    ouvertePar: uuid("ouverte_par"),
    /** Espèces comptées à l'ouverture. */
    fondCaisse: money("fond_caisse").notNull(),

    clotureeLe: timestamp("cloturee_le", { withTimezone: true }),
    cloturePar: uuid("cloture_par"),
    especesComptees: money("especes_comptees"),
    /** Compté moins attendu : négatif, il manque de l'argent. */
    ecartEspeces: money("ecart_especes"),
    ecriture: text("ecriture"),
    observations: text("observations"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("sessions_guichet_numero_unique").on(t.organizationId, t.numero),
    uniqueIndex("sessions_guichet_une_ouverte")
      .on(t.organizationId)
      .where(sql`${t.statut} = 'ouverte'`),
    check("sessions_guichet_fond", sql`${t.fondCaisse} >= 0`),
    check(
      "sessions_guichet_cloture_complete",
      sql`${t.statut} = 'ouverte' OR (${t.especesComptees} IS NOT NULL AND ${t.ecartEspeces} IS NOT NULL)`,
    ),
  ],
);

/**
 * Float d'un réseau dans une session : relevé à l'ouverture, relevé à la
 * clôture. L'attendu se déduit des opérations, jamais d'une saisie.
 */
export const floatsSession = pgTable(
  "floats_session",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsGuichet.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reseau: reseauMonnaie("reseau").notNull(),
    ouverture: money("ouverture").notNull(),
    /** Solde lu dans l'application de l'opérateur au moment de la clôture. */
    releveCloture: money("releve_cloture"),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.reseau] }),
    check("floats_session_positifs", sql`${t.ouverture} >= 0 AND coalesce(${t.releveCloture}, 0) >= 0`),
  ],
);

/**
 * Nature d'une opération.
 *
 *   depot           — le client remet des espèces, l'agent envoie de la valeur
 *   retrait         — le client reçoit des espèces, le compte de l'agent est crédité
 *   credit          — vente de crédit d'appel, payée en espèces
 *   approvisionnement — l'agent achète du float avec ses espèces (super-agent, banque)
 *   destockage      — l'agent revend du float contre des espèces
 */
export const typeOperationGuichet = pgEnum("type_operation_guichet", [
  "depot",
  "retrait",
  "credit",
  "approvisionnement",
  "destockage",
]);

export const operationsGuichet = pgTable(
  "operations_guichet",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsGuichet.id, { onDelete: "restrict" }),

    numero: text("numero").notNull(),
    type: typeOperationGuichet("type").notNull(),
    reseau: reseauMonnaie("reseau").notNull(),
    /** Numéro du client, ou celui rechargé pour une vente de crédit. */
    telephone: text("telephone"),
    montant: money("montant").notNull(),
    /**
     * Commission de l'agent. Versée par l'opérateur, pas par le client : elle
     * ne passe pas par le tiroir et ne fausse donc pas le rapprochement.
     */
    commission: money("commission").notNull().default(0),
    /** Identifiant de transaction donné par l'opérateur, pour retrouver une contestation. */
    referenceOperateur: text("reference_operateur"),

    annuleeLe: timestamp("annulee_le", { withTimezone: true }),
    motif: text("motif"),
    userId: uuid("user_id"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("operations_guichet_numero_unique").on(t.organizationId, t.numero),
    check("operations_guichet_montant", sql`${t.montant} > 0 AND ${t.commission} >= 0`),
    check("operations_guichet_annulation_motivee", sql`${t.annuleeLe} IS NULL OR ${t.motif} IS NOT NULL`),
    index("operations_guichet_session_idx").on(t.sessionId, t.createdAt),
  ],
);

export type Reseau = (typeof reseauMonnaie.enumValues)[number];
export type TypeOperationGuichet = (typeof typeOperationGuichet.enumValues)[number];
export type SessionGuichet = typeof sessionsGuichet.$inferSelect;
export type OperationGuichet = typeof operationsGuichet.$inferSelect;
