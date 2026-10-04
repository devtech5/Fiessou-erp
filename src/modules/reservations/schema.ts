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

import { money, primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { tiers } from "@/modules/tiers/schema";

/**
 * Nature de la ressource.
 *
 * Un seul moteur porte cinq entrées du périmètre : location de matériel et
 * d'engins, location immobilière, matériel événementiel, hôtellerie et
 * résidences, salles. Le modèle ne change jamais — une ressource, un
 * calendrier, une grille de tarifs, une caution, un état à la restitution.
 * Seul le vocabulaire varie.
 */
export const typeRessource = pgEnum("type_ressource", [
  "equipement",
  "chambre",
  "salle",
  "creneau",
]);

/**
 * État de service. « Loué » n'en est pas un : c'est ce que disent les
 * contrats en cours. Un drapeau posé à la main divergerait du planning.
 */
export const statutRessource = pgEnum("statut_ressource", ["active", "maintenance", "retiree"]);

export const ressources = pgTable(
  "ressources",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    code: text("code").notNull(),
    designation: text("designation").notNull(),
    type: typeRessource("type").notNull().default("equipement"),
    categorie: text("categorie"),
    statut: statutRessource("statut").notNull().default("active"),

    /** Exemplaires au parc. Une chambre est unique, pas un lot de chaises. */
    quantite: integer("quantite").notNull().default(1),

    /**
     * Grille TTC, en francs entiers. Toutes les durées ne sont pas servies :
     * une salle de fête ne se loue pas au mois.
     */
    tarifJour: money("tarif_jour"),
    tarifSemaine: money("tarif_semaine"),
    tarifMois: money("tarif_mois"),
    /** Dépôt de garantie par exemplaire. */
    caution: money("caution").notNull().default(0),
    /** Points de base : 1800 = 18 %. La location de biens est taxable. */
    tauxTva: integer("taux_tva").notNull().default(1800),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("ressources_code_unique").on(t.organizationId, t.code),
    check("ressources_quantite_positive", sql`${t.quantite} > 0`),
    check(
      "ressources_tarifs_positifs",
      sql`coalesce(${t.tarifJour}, 0) >= 0 AND coalesce(${t.tarifSemaine}, 0) >= 0
        AND coalesce(${t.tarifMois}, 0) >= 0 AND ${t.caution} >= 0`,
    ),
    index("ressources_org_idx").on(t.organizationId, t.statut),
  ],
);

/**
 * Statut d'un contrat. « En retard » n'en est pas un : c'est un contrat en
 * cours dont la fin est passée, et la base le juge à l'instant de la lecture.
 */
export const statutContrat = pgEnum("statut_contrat", ["reserve", "en_cours", "restitue", "annule"]);

export const etatRestitution = pgEnum("etat_restitution", ["bon", "endommage", "perdu"]);

export const moyenLocation = pgEnum("moyen_location", ["especes", "mobile_money", "banque"]);

/**
 * Contrat de location, de séjour ou de mise à disposition.
 *
 * Le montant et la caution sont FIGÉS à la signature : un tarif modifié
 * ensuite ne change pas ce que le client a accepté.
 *
 * La période est inclusive : du 20 au 27 occupe le 27. La caution n'est pas un
 * produit — elle est détenue (compte 165) et rendue, sauf la retenue pour
 * dégât, perte ou retard, qui seule devient une recette.
 */
export const contratsLocation = pgTable(
  "contrats_location",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    numero: text("numero").notNull(),
    ressourceId: uuid("ressource_id")
      .notNull()
      .references(() => ressources.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => tiers.id, { onDelete: "restrict" }),

    quantite: integer("quantite").notNull().default(1),
    debut: date("debut").notNull(),
    fin: date("fin").notNull(),
    /** Base retenue par la grille : jour, semaine ou mois. */
    baseTarif: text("base_tarif").notNull(),
    montant: money("montant").notNull(),
    caution: money("caution").notNull().default(0),

    statut: statutContrat("statut").notNull().default("reserve"),

    /** Remise au client : encaissement du montant et de la caution. */
    remisLe: timestamp("remis_le", { withTimezone: true }),
    moyenEncaissement: moyenLocation("moyen_encaissement"),
    ecritureRemise: text("ecriture_remise"),

    restitueLe: timestamp("restitue_le", { withTimezone: true }),
    etatRestitution: etatRestitution("etat_restitution"),
    retenue: money("retenue").notNull().default(0),
    ecritureRestitution: text("ecriture_restitution"),

    motif: text("motif"),
    notes: text("notes"),
    userId: uuid("user_id"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("contrats_location_numero_unique").on(t.organizationId, t.numero),
    check("contrats_location_periode", sql`${t.fin} >= ${t.debut}`),
    check("contrats_location_quantite", sql`${t.quantite} > 0`),
    check(
      "contrats_location_montants",
      sql`${t.montant} >= 0 AND ${t.caution} >= 0 AND ${t.retenue} >= 0 AND ${t.retenue} <= ${t.caution}`,
    ),
    check(
      "contrats_location_annulation_motivee",
      sql`${t.statut} <> 'annule' OR ${t.motif} IS NOT NULL`,
    ),
    index("contrats_location_ressource_idx").on(t.ressourceId, t.debut, t.fin),
    index("contrats_location_org_idx").on(t.organizationId, t.statut),
  ],
);

/**
 * Abonnement : salle de sport, club, cours.
 *
 * Deux régimes : au forfait (accès illimité jusqu'à la fin) et à la séance (un
 * capital qui se consomme). Les séances consommées ne sont PAS stockées : ce
 * sont les passages enregistrés.
 */
export const abonnements = pgTable(
  "abonnements",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Code de l'adhérent, celui de sa carte : AB-0012. */
    code: text("code").notNull(),
    nom: text("nom").notNull(),
    telephone: text("telephone"),
    clientId: uuid("client_id").references(() => tiers.id, { onDelete: "set null" }),

    formule: text("formule").notNull(),
    debut: date("debut").notNull(),
    fin: date("fin").notNull(),
    montant: money("montant").notNull(),
    /** Nul : accès illimité sur la période. */
    seancesIncluses: integer("seances_incluses"),

    moyenEncaissement: moyenLocation("moyen_encaissement").notNull(),
    ecriture: text("ecriture"),
    userId: uuid("user_id"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("abonnements_code_unique").on(t.organizationId, t.code),
    check("abonnements_periode", sql`${t.fin} >= ${t.debut}`),
    check("abonnements_montant", sql`${t.montant} >= 0`),
    check(
      "abonnements_seances",
      sql`${t.seancesIncluses} IS NULL OR ${t.seancesIncluses} > 0`,
    ),
    index("abonnements_org_idx").on(t.organizationId, t.fin),
  ],
);

/** Venue d'un adhérent. Son nombre EST la consommation. */
export const passagesAbonnement = pgTable(
  "passages_abonnement",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    abonnementId: uuid("abonnement_id")
      .notNull()
      .references(() => abonnements.id, { onDelete: "cascade" }),
    venuLe: timestamp("venu_le", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id"),

    ...timestamps,
  },
  (t) => [index("passages_abonnement_idx").on(t.abonnementId, t.venuLe)],
);

export type Ressource = typeof ressources.$inferSelect;
export type TypeRessource = Ressource["type"];
export type StatutRessource = Ressource["statut"];
export type ContratLocation = typeof contratsLocation.$inferSelect;
export type StatutContrat = ContratLocation["statut"];
export type EtatRestitution = NonNullable<ContratLocation["etatRestitution"]>;
export type MoyenLocation = NonNullable<ContratLocation["moyenEncaissement"]>;
