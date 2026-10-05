import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { money, primaryId, quantity, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { articles } from "@/modules/catalogue/schema";
import { commerciaux } from "@/modules/commerciaux/schema";
import { depots } from "@/modules/stock/schema";
import { projets } from "@/modules/projets/schema";
import { tiers } from "@/modules/tiers/schema";

/**
 * Nature d'une pièce commerciale.
 *
 * Trois états d'un même flux, pas trois métiers : un devis devient une
 * facture, une facture se corrige par un avoir. Une seule table les porte, ce
 * qui permet de suivre une affaire d'un bout à l'autre sans traverser trois
 * modules.
 */
export const naturePiece = pgEnum("nature_piece", ["devis", "facture", "avoir"]);

/**
 * Statut d'une pièce.
 *
 * `brouillon` se modifie et ne porte PAS de numéro : le numéro n'est attribué
 * qu'à l'émission, dans la transaction qui la pose. Un brouillon abandonné ne
 * laisse donc pas de trou dans la suite des factures — ce que la DGI
 * reprocherait le jour d'un contrôle.
 *
 * Une pièce émise ne se modifie plus. Une facture se corrige par un avoir ; un
 * devis s'accepte, se refuse ou se convertit.
 *
 * « Payée » n'est pas un statut : c'est ce que disent les règlements reçus.
 * Un statut posé à la main divergerait de l'argent réellement encaissé.
 */
export const statutPiece = pgEnum("statut_piece", [
  "brouillon",
  "emise",
  "acceptee",
  "refusee",
  "convertie",
  "annulee",
]);

export const piecesCommerciales = pgTable(
  "pieces_commerciales",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    nature: naturePiece("nature").notNull(),
    /** FAC-2026-00012. Nul tant que la pièce est en brouillon. */
    numero: text("numero"),
    statut: statutPiece("statut").notNull().default("brouillon"),

    clientId: uuid("client_id")
      .notNull()
      .references(() => tiers.id, { onDelete: "restrict" }),
    /**
     * Projet auquel la pièce se rattache : c'est ce qui permet de dire si un
     * chantier a gagné ou perdu de l'argent.
     */
    projetId: uuid("projet_id").references(() => projets.id, { onDelete: "set null" }),
    /** Nom recopié à l'émission : une facture réimprimée dit à qui elle a été adressée. */
    clientNom: text("client_nom").notNull(),

    datePiece: date("date_piece").notNull(),
    /** Échéance de paiement (facture) ou fin de validité (devis). */
    echeance: date("echeance"),

    /**
     * Dépôt d'où sort la marchandise facturée. Une facture de marchandise est
     * aussi une sortie de stock : sans elle, le stock affiché garderait ce
     * qui a été livré.
     */
    depotId: uuid("depot_id").references(() => depots.id, { onDelete: "restrict" }),

    /** Devis d'origine d'une facture, facture d'origine d'un avoir. */
    origineId: uuid("origine_id"),

    /** Commercial à qui la pièce est attribuée ; sa commission la compte. */
    commercialId: uuid("commercial_id").references(() => commerciaux.id, { onDelete: "set null" }),

    /**
     * Totaux STOCKÉS, comme ceux d'un ticket : une pièce émise est un
     * document montré au client, dont le montant ne doit pas changer si un
     * prix ou un taux bouge ensuite. Recalculés à chaque modification du
     * brouillon, figés à l'émission.
     */
    totalHt: money("total_ht").notNull().default(0),
    totalTva: money("total_tva").notNull().default(0),
    totalTtc: money("total_ttc").notNull().default(0),

    /** Numéro de l'écriture comptable posée à l'émission. */
    ecritureNumero: text("ecriture_numero"),

    notes: text("notes"),
    motifAnnulation: text("motif_annulation"),
    emiseLe: timestamp("emise_le", { withTimezone: true }),
    userId: uuid("user_id"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("pieces_commerciales_numero_unique").on(t.organizationId, t.numero),
    check(
      "pieces_commerciales_totaux_positifs",
      sql`${t.totalHt} >= 0 AND ${t.totalTva} >= 0 AND ${t.totalTtc} >= 0`,
    ),
    /** Une pièce sortie du brouillon porte son numéro, toujours. */
    check(
      "pieces_commerciales_numero_emis",
      sql`${t.statut} = 'brouillon' OR ${t.numero} IS NOT NULL`,
    ),
    check(
      "pieces_commerciales_annulation_motivee",
      sql`${t.statut} <> 'annulee' OR ${t.motifAnnulation} IS NOT NULL`,
    ),
    index("pieces_commerciales_org_idx").on(t.organizationId, t.nature, t.statut),
    index("pieces_commerciales_client_idx").on(t.organizationId, t.clientId),
    index("pieces_commerciales_origine_idx").on(t.origineId),
  ],
);

/**
 * Ligne de pièce.
 *
 * Prix HORS TAXES : une facture entre entreprises se négocie hors taxes, à
 * l'inverse du prix de rayon d'une caisse, qui est TTC. Le taux de TVA et le
 * compte de produit sont lus sur l'article par le serveur, jamais reçus du
 * navigateur : ils relèvent du droit fiscal, pas de la saisie.
 */
export const lignesPiece = pgTable(
  "lignes_piece",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => piecesCommerciales.id, { onDelete: "cascade" }),

    ordre: integer("ordre").notNull().default(0),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "restrict" }),
    designation: text("designation").notNull(),
    /** En millièmes d'unité. */
    quantite: quantity("quantite").notNull(),
    unite: text("unite").notNull().default("piece"),
    prixUnitaireHt: money("prix_unitaire_ht").notNull(),
    remise: money("remise").notNull().default(0),
    montantHt: money("montant_ht").notNull(),
    /** Points de base : 1800 = 18 %. */
    tauxTva: integer("taux_tva").notNull(),
    compteVente: text("compte_vente").notNull().default("701"),

    ...timestamps,
  },
  (t) => [
    check("lignes_piece_quantite_positive", sql`${t.quantite} > 0`),
    check(
      "lignes_piece_montants_positifs",
      sql`${t.prixUnitaireHt} >= 0 AND ${t.remise} >= 0 AND ${t.montantHt} >= 0`,
    ),
    check("lignes_piece_taux_borne", sql`${t.tauxTva} >= 0 AND ${t.tauxTva} <= 10000`),
    index("lignes_piece_piece_idx").on(t.pieceId, t.ordre),
  ],
);

export const moyenReglementPiece = pgEnum("moyen_reglement_piece", [
  "especes",
  "mobile_money",
  "banque",
]);

/**
 * Règlement reçu sur une facture.
 *
 * Plusieurs par facture : l'acompte puis le solde, ou trois versements mobile
 * money. Le reste dû se DÉDUIT de leur somme ; il n'est stocké nulle part.
 */
export const reglementsPiece = pgTable(
  "reglements_piece",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => piecesCommerciales.id, { onDelete: "restrict" }),

    numero: text("numero").notNull(),
    dateReglement: date("date_reglement").notNull(),
    moyen: moyenReglementPiece("moyen").notNull(),
    montant: money("montant").notNull(),
    reference: text("reference"),
    ecritureNumero: text("ecriture_numero"),
    userId: uuid("user_id"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("reglements_piece_numero_unique").on(t.organizationId, t.numero),
    check("reglements_piece_montant_positif", sql`${t.montant} > 0`),
    index("reglements_piece_piece_idx").on(t.pieceId),
  ],
);

export type PieceCommerciale = typeof piecesCommerciales.$inferSelect;
export type LignePieceCommerciale = typeof lignesPiece.$inferSelect;
export type NaturePiece = PieceCommerciale["nature"];
export type StatutPiece = PieceCommerciale["statut"];
export type MoyenReglementPiece = (typeof reglementsPiece.$inferSelect)["moyen"];
