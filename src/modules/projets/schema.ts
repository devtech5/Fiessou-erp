import { sql } from "drizzle-orm";
import {
  bigint,
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

import { money, primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { tiers } from "@/modules/tiers/schema";

/**
 * Projet : un chantier, une ouverture de boutique, une campagne, un
 * aménagement. Ce qui compte n'est pas la planification fine, c'est de savoir
 * à quoi l'argent a servi — chaque dépense s'y rattache, avec sa preuve.
 */
export const statutProjet = pgEnum("statut_projet", ["preparation", "en_cours", "suspendu", "termine", "annule"]);

export const projets = pgTable(
  "projets",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    code: text("code").notNull(),
    nom: text("nom").notNull(),
    description: text("description"),
    /** Client pour qui le projet est mené, le cas échéant. */
    clientId: uuid("client_id").references(() => tiers.id, { onDelete: "set null" }),
    /** Utilisateur qui répond du projet : il voit, il demande, il rend compte. */
    responsableUserId: uuid("responsable_user_id"),
    /** Enveloppe autorisée, TTC. Nulle : pas de plafond fixé. */
    budget: money("budget"),
    /** Prix de vente convenu avec le client, HT. Nul : projet interne. */
    prixVente: money("prix_vente"),
    debut: date("debut"),
    fin: date("fin"),
    statut: statutProjet("statut").notNull().default("preparation"),
    /** Date de fin RÉELLE, posée au passage en « terminé » : c'est elle qui juge le délai. */
    termineLe: date("termine_le"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("projets_code_unique").on(t.organizationId, t.code),
    check("projets_budget", sql`${t.budget} IS NULL OR ${t.budget} >= 0`),
    check("projets_prix_vente", sql`${t.prixVente} IS NULL OR ${t.prixVente} >= 0`),
    check("projets_periode", sql`${t.fin} IS NULL OR ${t.debut} IS NULL OR ${t.fin} >= ${t.debut}`),
    index("projets_org_idx").on(t.organizationId, t.statut),
  ],
);

/**
 * Circuit d'une dépense. Chaque étape garde qui l'a franchie et quand : c'est
 * la traçabilité demandée — on ne sait pas seulement qu'on a payé, mais qui
 * l'a demandé, qui l'a accepté et qui a sorti l'argent.
 */
export const statutDepense = pgEnum("statut_depense", ["demandee", "approuvee", "payee", "rejetee", "annulee"]);

export const moyenDepense = pgEnum("moyen_depense", ["especes", "mobile_money", "banque"]);

export const depenses = pgTable(
  "depenses",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    numero: text("numero").notNull(),
    projetId: uuid("projet_id").references(() => projets.id, { onDelete: "set null" }),
    objet: text("objet").notNull(),
    /** Nature de la dépense : décide du compte de charge. */
    categorie: text("categorie").notNull(),
    fournisseurId: uuid("fournisseur_id").references(() => tiers.id, { onDelete: "set null" }),
    /** Fournisseur de passage, sans fiche : la quincaillerie du coin. */
    fournisseurLibelle: text("fournisseur_libelle"),

    /** Montant TTC, en francs entiers. */
    montant: money("montant").notNull(),
    /** Points de base : 1800 = 18 %. Zéro sans facture normalisée. */
    tauxTva: integer("taux_tva").notNull().default(0),
    statut: statutDepense("statut").notNull().default("demandee"),

    demandeeLe: timestamp("demandee_le", { withTimezone: true }).notNull().defaultNow(),
    demandeeParUserId: uuid("demandee_par_user_id"),
    approuveeLe: timestamp("approuvee_le", { withTimezone: true }),
    approuveeParUserId: uuid("approuvee_par_user_id"),
    payeeLe: timestamp("payee_le", { withTimezone: true }),
    payeeParUserId: uuid("payee_par_user_id"),
    moyen: moyenDepense("moyen"),
    /** Référence de la transaction : numéro de chèque, identifiant mobile money. */
    referencePaiement: text("reference_paiement"),
    ecriture: text("ecriture"),
    motif: text("motif"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("depenses_numero_unique").on(t.organizationId, t.numero),
    check("depenses_montant", sql`${t.montant} > 0 AND ${t.tauxTva} >= 0`),
    check(
      "depenses_paiement_complet",
      sql`${t.statut} <> 'payee' OR (${t.payeeLe} IS NOT NULL AND ${t.moyen} IS NOT NULL)`,
    ),
    check("depenses_refus_motive", sql`${t.statut} NOT IN ('rejetee', 'annulee') OR ${t.motif} IS NOT NULL`),
    index("depenses_projet_idx").on(t.projetId),
    index("depenses_org_idx").on(t.organizationId, t.statut),
  ],
);

/**
 * Pièce jointe d'un projet ou d'une dépense : photo de chantier, preuve de
 * paiement, facture du fournisseur. Le fichier vit dans le dépôt ; ici, sa
 * fiche et son rattachement.
 */
export const naturePieceProjet = pgEnum("nature_piece_projet", ["photo", "preuve_paiement", "facture", "autre"]);

export const piecesProjet = pgTable(
  "pieces_projet",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projetId: uuid("projet_id").references(() => projets.id, { onDelete: "cascade" }),
    depenseId: uuid("depense_id").references(() => depenses.id, { onDelete: "cascade" }),

    nature: naturePieceProjet("nature").notNull(),
    legende: text("legende"),
    chemin: text("chemin").notNull(),
    nomFichier: text("nom_fichier").notNull(),
    typeMime: text("type_mime").notNull(),
    tailleOctets: bigint("taille_octets", { mode: "number" }).notNull(),
    deposeParUserId: uuid("depose_par_user_id"),

    ...timestamps,
  },
  (t) => [
    unique("pieces_projet_chemin_unique").on(t.organizationId, t.chemin),
    check("pieces_projet_rattachee", sql`${t.projetId} IS NOT NULL OR ${t.depenseId} IS NOT NULL`),
    index("pieces_projet_projet_idx").on(t.projetId),
    index("pieces_projet_depense_idx").on(t.depenseId),
  ],
);

export type Projet = typeof projets.$inferSelect;
export type StatutProjet = Projet["statut"];
export type Depense = typeof depenses.$inferSelect;
export type StatutDepense = Depense["statut"];
export type MoyenDepense = NonNullable<Depense["moyen"]>;
export type NaturePieceProjet = (typeof piecesProjet.$inferSelect)["nature"];
