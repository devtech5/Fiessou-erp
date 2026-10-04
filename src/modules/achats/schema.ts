import { sql } from "drizzle-orm";
import { check, date, index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { money, primaryId, quantity, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { articles } from "@/modules/catalogue/schema";
import { depots } from "@/modules/stock/schema";
import { tiers } from "@/modules/tiers/schema";
import { comptesTresorerie } from "@/modules/tresorerie/schema";

/**
 * Achats et fournisseurs.
 *
 * Bon de commande → bon de réception → facture fournisseur → règlement.
 * Le stock entre à la réception, au prix commandé ; la dette naît à la facture ;
 * elle s'éteint au règlement. Les totaux portés ici sont recopiés de l'écriture
 * calculée, jamais recalculés à part.
 */

export const statutCommandeAchat = pgEnum("statut_commande_achat", ["brouillon", "envoyee", "partielle", "recue", "annulee"]);

export const commandesAchat = pgTable(
  "commandes_achat",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** BCF-2026-00012. */
    numero: text("numero").notNull(),
    fournisseurId: uuid("fournisseur_id")
      .notNull()
      .references(() => tiers.id, { onDelete: "restrict" }),
    /** Nom recopié : le bon reste lisible si la fiche est renommée. */
    fournisseurNom: text("fournisseur_nom").notNull(),
    /** Dépôt où la marchandise est attendue. */
    depotId: uuid("depot_id").references(() => depots.id, { onDelete: "restrict" }),
    dateCommande: date("date_commande").notNull(),
    livraisonPrevue: date("livraison_prevue"),
    statut: statutCommandeAchat("statut").notNull().default("brouillon"),
    totalHt: money("total_ht").notNull().default(0),
    totalTva: money("total_tva").notNull().default(0),
    totalTtc: money("total_ttc").notNull().default(0),
    notes: text("notes"),
    creeParUserId: uuid("cree_par_user_id"),
    envoyeeLe: timestamp("envoyee_le", { withTimezone: true }),
    motifAnnulation: text("motif_annulation"),
    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("commandes_achat_numero_unique").on(t.organizationId, t.numero),
    check("commandes_achat_totaux", sql`${t.totalHt} >= 0 AND ${t.totalTva} >= 0 AND ${t.totalTtc} = ${t.totalHt} + ${t.totalTva}`),
    check("commandes_achat_annulation_motivee", sql`${t.statut} <> 'annulee' OR ${t.motifAnnulation} IS NOT NULL`),
    index("commandes_achat_statut_idx").on(t.organizationId, t.statut),
    index("commandes_achat_fournisseur_idx").on(t.organizationId, t.fournisseurId),
  ],
);

export const lignesCommandeAchat = pgTable(
  "lignes_commande_achat",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    commandeId: uuid("commande_id")
      .notNull()
      .references(() => commandesAchat.id, { onDelete: "cascade" }),
    /** Article du catalogue ; nul pour une ligne libre (transport, prestation). */
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "restrict" }),
    designation: text("designation").notNull(),
    /** En millièmes d'unité. */
    quantite: quantity("quantite").notNull(),
    prixUnitaireHt: money("prix_unitaire_ht").notNull(),
    tauxTva: integer("taux_tva").notNull().default(1800),
    compteAchat: text("compte_achat").notNull().default("601"),
    ordre: integer("ordre").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("lignes_commande_achat_valeurs", sql`${t.quantite} > 0 AND ${t.prixUnitaireHt} >= 0 AND ${t.tauxTva} >= 0`),
    index("lignes_commande_achat_idx").on(t.commandeId, t.ordre),
  ],
);

/** Bon de réception : ce qui est réellement arrivé au dépôt, et quand. */
export const receptionsAchat = pgTable(
  "receptions_achat",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** BR-2026-00031. */
    numero: text("numero").notNull(),
    commandeId: uuid("commande_id")
      .notNull()
      .references(() => commandesAchat.id, { onDelete: "restrict" }),
    depotId: uuid("depot_id")
      .notNull()
      .references(() => depots.id, { onDelete: "restrict" }),
    dateReception: date("date_reception").notNull(),
    /** Bordereau de livraison du fournisseur. */
    bordereau: text("bordereau"),
    notes: text("notes"),
    userId: uuid("user_id").notNull(),
    ...timestamps,
  },
  (t) => [unique("receptions_achat_numero_unique").on(t.organizationId, t.numero), index("receptions_achat_commande_idx").on(t.commandeId)],
);

export const lignesReceptionAchat = pgTable(
  "lignes_reception_achat",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    receptionId: uuid("reception_id")
      .notNull()
      .references(() => receptionsAchat.id, { onDelete: "cascade" }),
    ligneCommandeId: uuid("ligne_commande_id")
      .notNull()
      .references(() => lignesCommandeAchat.id, { onDelete: "restrict" }),
    quantite: quantity("quantite").notNull(),
    /** Mouvement de stock produit ; nul pour une ligne libre. */
    mouvementId: uuid("mouvement_id"),
    ...timestamps,
  },
  (t) => [check("lignes_reception_achat_quantite", sql`${t.quantite} > 0`), index("lignes_reception_achat_ligne_idx").on(t.ligneCommandeId)],
);

export const statutFactureFournisseur = pgEnum("statut_facture_fournisseur", ["comptabilisee", "annulee"]);

/**
 * Facture fournisseur. Rattachée à une commande quand elle en vient ; libre
 * pour les frais généraux — électricité, loyer, honoraires.
 */
export const facturesFournisseur = pgTable(
  "factures_fournisseur",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Numéro interne : FF-2026-00045. */
    numero: text("numero").notNull(),
    /** Numéro porté par la facture du fournisseur. */
    referenceFournisseur: text("reference_fournisseur").notNull(),
    fournisseurId: uuid("fournisseur_id")
      .notNull()
      .references(() => tiers.id, { onDelete: "restrict" }),
    fournisseurNom: text("fournisseur_nom").notNull(),
    commandeId: uuid("commande_id").references(() => commandesAchat.id, { onDelete: "restrict" }),
    dateFacture: date("date_facture").notNull(),
    echeance: date("echeance").notNull(),
    totalHt: money("total_ht").notNull(),
    totalTva: money("total_tva").notNull(),
    totalTtc: money("total_ttc").notNull(),
    statut: statutFactureFournisseur("statut").notNull().default("comptabilisee"),
    ecriture: text("ecriture").notNull(),
    justificatifChemin: text("justificatif_chemin"),
    justificatifNom: text("justificatif_nom"),
    notes: text("notes"),
    userId: uuid("user_id").notNull(),
    motifAnnulation: text("motif_annulation"),
    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("factures_fournisseur_numero_unique").on(t.organizationId, t.numero),
    // Une même facture du fournisseur ne s'enregistre pas deux fois : c'est
    // la double saisie qui fait payer deux fois.
    unique("factures_fournisseur_reference_unique").on(t.organizationId, t.fournisseurId, t.referenceFournisseur),
    check("factures_fournisseur_totaux", sql`${t.totalTtc} = ${t.totalHt} + ${t.totalTva} AND ${t.totalTtc} > 0`),
    check("factures_fournisseur_echeance", sql`${t.echeance} >= ${t.dateFacture}`),
    index("factures_fournisseur_echeance_idx").on(t.organizationId, t.echeance),
  ],
);

export const lignesFactureFournisseur = pgTable(
  "lignes_facture_fournisseur",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    factureId: uuid("facture_id")
      .notNull()
      .references(() => facturesFournisseur.id, { onDelete: "cascade" }),
    ligneCommandeId: uuid("ligne_commande_id").references(() => lignesCommandeAchat.id, { onDelete: "restrict" }),
    designation: text("designation").notNull(),
    quantite: quantity("quantite").notNull(),
    prixUnitaireHt: money("prix_unitaire_ht").notNull(),
    tauxTva: integer("taux_tva").notNull(),
    compteAchat: text("compte_achat").notNull(),
    ordre: integer("ordre").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("lignes_facture_fournisseur_valeurs", sql`${t.quantite} > 0 AND ${t.prixUnitaireHt} >= 0 AND ${t.tauxTva} >= 0`),
    index("lignes_facture_fournisseur_idx").on(t.factureId),
  ],
);

/** Règlement d'une facture fournisseur, depuis un compte de trésorerie. */
export const reglementsFournisseur = pgTable(
  "reglements_fournisseur",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    numero: text("numero").notNull(),
    factureId: uuid("facture_id")
      .notNull()
      .references(() => facturesFournisseur.id, { onDelete: "restrict" }),
    compteTresorerieId: uuid("compte_tresorerie_id")
      .notNull()
      .references(() => comptesTresorerie.id, { onDelete: "restrict" }),
    montant: money("montant").notNull(),
    dateReglement: date("date_reglement").notNull(),
    /** N° de chèque, de virement, de transaction. */
    reference: text("reference"),
    ecriture: text("ecriture").notNull(),
    userId: uuid("user_id").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("reglements_fournisseur_numero_unique").on(t.organizationId, t.numero),
    check("reglements_fournisseur_montant", sql`${t.montant} > 0`),
    index("reglements_fournisseur_facture_idx").on(t.factureId),
  ],
);

export type CommandeAchat = typeof commandesAchat.$inferSelect;
export type FactureFournisseur = typeof facturesFournisseur.$inferSelect;
