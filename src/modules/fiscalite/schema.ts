import { sql } from "drizzle-orm";
import { check, date, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { money, primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { comptesTresorerie } from "@/modules/tresorerie/schema";

/**
 * Déclaration de TVA d'un mois : ce qui a été liquidé, et ce qui a été payé.
 * Les montants sont recopiés de l'écriture de liquidation au moment où elle
 * est passée ; le crédit reporté alimente la déclaration suivante.
 */
export const declarationsTva = pgTable(
  "declarations_tva",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** AAAA-MM. */
    mois: text("mois").notNull(),
    collectee: money("collectee").notNull(),
    deductible: money("deductible").notNull(),
    creditAnterieur: money("credit_anterieur").notNull().default(0),
    aPayer: money("a_payer").notNull(),
    creditReporte: money("credit_reporte").notNull().default(0),
    ecriture: text("ecriture"),
    deposeeLe: timestamp("deposee_le", { withTimezone: true }).notNull().defaultNow(),
    deposeeParUserId: uuid("deposee_par_user_id").notNull(),
    payeeLe: date("payee_le"),
    ecriturePaiement: text("ecriture_paiement"),
    compteTresorerieId: uuid("compte_tresorerie_id").references(() => comptesTresorerie.id, { onDelete: "restrict" }),
    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("declarations_tva_mois_unique").on(t.organizationId, t.mois),
    check("declarations_tva_mois_format", sql`${t.mois} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("declarations_tva_montants", sql`${t.aPayer} >= 0 AND ${t.creditReporte} >= 0 AND (${t.aPayer} = 0 OR ${t.creditReporte} = 0)`),
  ],
);

/**
 * Exercice clôturé : son résultat est passé en 13, et plus aucune écriture
 * ne peut y être datée. Une réouverture contrepasse la clôture et se trace.
 */
export const exercicesClotures = pgTable(
  "exercices_clotures",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    exercice: text("exercice").notNull(),
    resultat: money("resultat").notNull(),
    ecriture: text("ecriture").notNull(),
    clotureLe: timestamp("cloture_le", { withTimezone: true }).notNull().defaultNow(),
    clotureParUserId: uuid("cloture_par_user_id").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("exercices_clotures_unique").on(t.organizationId, t.exercice),
    check("exercices_clotures_format", sql`${t.exercice} ~ '^[0-9]{4}$'`),
  ],
);

export type DeclarationTva = typeof declarationsTva.$inferSelect;
export type ExerciceCloture = typeof exercicesClotures.$inferSelect;
