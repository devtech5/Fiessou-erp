import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { money, primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { tiers } from "@/modules/tiers/schema";

/**
 * Prestataires externes : plombier, électricien, photographe, monteur vidéo,
 * graphiste, consultant — un indépendant qui annonce un prix et réalise une
 * prestation.
 *
 * Distinct de l'intervenant (`workers`), pointé et payé à la journée. Le
 * prestataire a une FICHE TIERS (coordonnées, NCC, compte fournisseur) : ce
 * module y ajoute son métier, sa zone, son tarif, ses prestations et l'avis
 * qu'on en a.
 */

export const uniteTarif = pgEnum("unite_tarif", ["heure", "jour", "prestation", "forfait", "metre_carre"]);

export const prestataires = pgTable(
  "prestataires",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tiersId: uuid("tiers_id")
      .notNull()
      .references(() => tiers.id, { onDelete: "restrict" }),
    /** Métiers exercés : un électricien fait souvent aussi la climatisation. */
    metiers: text("metiers").array().notNull(),
    specialites: text("specialites"),
    /** Où il intervient : communes, villes. */
    zone: text("zone"),
    tarif: money("tarif"),
    uniteTarif: uniteTarif("unite_tarif"),
    /** Déclaré (NCC, RCCM) ou informel : pèse sur la retenue à la source. */
    formel: boolean("formel").notNull().default(false),
    /** Numéro où le payer par mobile money. */
    mobileMoney: text("mobile_money"),
    disponible: boolean("disponible").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("prestataires_tiers_unique").on(t.organizationId, t.tiersId),
    check("prestataires_metiers", sql`cardinality(${t.metiers}) > 0`),
    check("prestataires_tarif", sql`${t.tarif} IS NULL OR ${t.tarif} >= 0`),
  ],
);

export const statutPrestation = pgEnum("statut_prestation", ["demandee", "confirmee", "realisee", "payee", "annulee"]);

/**
 * Prestation confiée : de la demande au paiement, avec l'avis porté sur le
 * travail. L'avis nourrit la note du prestataire — c'est ce qui fait choisir
 * le bon plombier la fois suivante.
 */
export const prestations = pgTable(
  "prestations",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    prestataireId: uuid("prestataire_id")
      .notNull()
      .references(() => prestataires.id, { onDelete: "restrict" }),
    /** PRE-2026-00001. */
    numero: text("numero").notNull(),
    objet: text("objet").notNull(),
    description: text("description"),
    lieu: text("lieu"),
    prevueLe: date("prevue_le"),
    /** Prix convenu, en francs. Nul tant qu'aucun devis n'est accepté. */
    montantConvenu: money("montant_convenu"),
    statut: statutPrestation("statut").notNull().default("demandee"),
    realiseeLe: timestamp("realisee_le", { withTimezone: true }),
    /** Avis, de 1 à 5, porté une fois la prestation réalisée. */
    note: integer("note"),
    avis: text("avis"),
    montantPaye: money("montant_paye"),
    retenue: money("retenue"),
    compteCharge: text("compte_charge"),
    ecritureNumero: text("ecriture_numero"),
    payeeLe: timestamp("payee_le", { withTimezone: true }),
    projetId: uuid("projet_id"),
    motifAnnulation: text("motif_annulation"),
    userId: uuid("user_id"),
    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("prestations_numero_unique").on(t.organizationId, t.numero),
    check("prestations_note", sql`${t.note} IS NULL OR ${t.note} BETWEEN 1 AND 5`),
    check("prestations_montants", sql`(${t.montantConvenu} IS NULL OR ${t.montantConvenu} >= 0) AND (${t.retenue} IS NULL OR ${t.retenue} >= 0)`),
    check("prestations_payee", sql`${t.statut} <> 'payee' OR (${t.montantPaye} IS NOT NULL AND ${t.ecritureNumero} IS NOT NULL)`),
    index("prestations_prestataire_idx").on(t.organizationId, t.prestataireId),
    index("prestations_statut_idx").on(t.organizationId, t.statut),
  ],
);

export type Prestataire = typeof prestataires.$inferSelect;
export type Prestation = typeof prestations.$inferSelect;
