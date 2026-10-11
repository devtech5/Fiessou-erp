import { sql } from "drizzle-orm";
import { check, date, index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { money, primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { contratsLocation, moyenLocation, ressources } from "@/modules/reservations/schema";

/**
 * Hôtellerie et résidences, posées sur le moteur de réservation.
 *
 * Une chambre EST une ressource de type `chambre`, un séjour EST un contrat de
 * location : la disponibilité, le planning et la numérotation (SEJ-) restent
 * ceux du moteur, et une chambre ne peut pas partir à la fois chez un client
 * de l'hôtel et chez un client du comptoir de location.
 *
 * Ce qui change, c'est le déroulé. À l'hôtel le client arrive sans payer, sa
 * note s'allonge pendant le séjour (restaurant, blanchisserie, minibar), il
 * verse parfois un acompte, et tout se solde au départ. Ces tables portent ce
 * déroulé ; le contrat, lui, porte la période et le prix de l'hébergement.
 *
 * Le contrat est inclusif : `fin` est la DERNIÈRE NUIT, pas le jour du départ.
 * Arrivée le 20, départ le 22 : deux nuits, contrat du 20 au 21 — et la
 * chambre se revend dès le 22.
 */

/** État de ménage. « Occupée » n'en est pas un : c'est ce que disent les séjours. */
export const menageChambre = pgEnum("menage_chambre", ["propre", "a_faire"]);

/**
 * Ce que l'hôtel sait d'une chambre en plus du moteur. Une chambre créée
 * depuis l'écran Réservations n'a pas encore de ligne ici : elle est lue
 * propre, au rez-de-chaussée, pour deux personnes, jusqu'au premier réglage.
 */
export const chambresHotel = pgTable(
  "chambres_hotel",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ressourceId: uuid("ressource_id")
      .notNull()
      .references(() => ressources.id, { onDelete: "cascade" }),

    etage: text("etage"),
    capacite: integer("capacite").notNull().default(2),
    menage: menageChambre("menage").notNull().default("propre"),
    menageLe: timestamp("menage_le", { withTimezone: true }),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("chambres_hotel_ressource_unique").on(t.ressourceId),
    check("chambres_hotel_capacite", sql`${t.capacite} > 0`),
    index("chambres_hotel_org_idx").on(t.organizationId),
  ],
);

/**
 * Le séjour : le contrat du moteur, plus ce que l'hôtel en suit.
 *
 * `prixNuit` est le tarif négocié. Nul, c'est la grille de la chambre qui
 * s'applique — nuit, semaine ou mois — et un changement de dates la relit.
 */
export const sejoursHotel = pgTable(
  "sejours_hotel",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contratId: uuid("contrat_id")
      .notNull()
      .references(() => contratsLocation.id, { onDelete: "cascade" }),

    adultes: integer("adultes").notNull().default(1),
    enfants: integer("enfants").notNull().default(0),
    prixNuit: money("prix_nuit"),

    arriveeLe: timestamp("arrivee_le", { withTimezone: true }),
    /** Caution reçue à l'arrivée : moyen et écriture (165). */
    moyenCaution: moyenLocation("moyen_caution"),
    ecritureCaution: text("ecriture_caution"),

    departLe: timestamp("depart_le", { withTimezone: true }),
    /** Montant de la note soldée au départ, hébergement et prestations. */
    totalNote: money("total_note"),
    ecritureDepart: text("ecriture_depart"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("sejours_hotel_contrat_unique").on(t.contratId),
    check("sejours_hotel_personnes", sql`${t.adultes} > 0 AND ${t.enfants} >= 0`),
    check("sejours_hotel_prix", sql`${t.prixNuit} IS NULL OR ${t.prixNuit} >= 0`),
    index("sejours_hotel_org_idx").on(t.organizationId),
  ],
);

/**
 * Une prestation se ventile sur son compte : la boisson du minibar est une
 * marchandise (701), la blanchisserie un service (706). Leur TVA peut différer.
 */
export const naturePrestation = pgEnum("nature_prestation_sejour", ["service", "marchandise"]);

/** Ligne de la note : ce que le client consomme pendant son séjour, en TTC. */
export const prestationsSejour = pgTable(
  "prestations_sejour",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sejourId: uuid("sejour_id")
      .notNull()
      .references(() => sejoursHotel.id, { onDelete: "cascade" }),

    jour: date("jour").notNull(),
    libelle: text("libelle").notNull(),
    nature: naturePrestation("nature").notNull().default("service"),
    quantite: integer("quantite").notNull().default(1),
    prixUnitaire: money("prix_unitaire").notNull(),
    montant: money("montant").notNull(),
    /** Points de base : 1800 = 18 %. */
    tauxTva: integer("taux_tva").notNull().default(1800),
    userId: uuid("user_id"),

    ...timestamps,
  },
  (t) => [
    check("prestations_sejour_quantite", sql`${t.quantite} > 0`),
    check("prestations_sejour_montant", sql`${t.prixUnitaire} >= 0 AND ${t.montant} = ${t.prixUnitaire} * ${t.quantite}`),
    index("prestations_sejour_idx").on(t.sejourId),
  ],
);

/**
 * Acompte versé avant le départ. Il n'est pas une recette : il attend la note
 * en 4191 (avances reçues des clients), qui le solde au départ.
 */
export const acomptesSejour = pgTable(
  "acomptes_sejour",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sejourId: uuid("sejour_id")
      .notNull()
      .references(() => sejoursHotel.id, { onDelete: "cascade" }),

    numero: text("numero").notNull(),
    jour: date("jour").notNull(),
    montant: money("montant").notNull(),
    moyen: moyenLocation("moyen").notNull(),
    ecriture: text("ecriture"),
    userId: uuid("user_id"),

    ...timestamps,
  },
  (t) => [
    unique("acomptes_sejour_numero_unique").on(t.organizationId, t.numero),
    check("acomptes_sejour_montant", sql`${t.montant} > 0`),
    index("acomptes_sejour_idx").on(t.sejourId),
  ],
);

/**
 * Fiche de police : qui a dormi dans l'établissement. L'hôtelier la tient pour
 * les autorités ; le registre se relit par période et s'imprime.
 */
export const voyageursSejour = pgTable(
  "voyageurs_sejour",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sejourId: uuid("sejour_id")
      .notNull()
      .references(() => sejoursHotel.id, { onDelete: "cascade" }),

    nom: text("nom").notNull(),
    prenoms: text("prenoms"),
    dateNaissance: date("date_naissance"),
    lieuNaissance: text("lieu_naissance"),
    nationalite: text("nationalite").notNull(),
    profession: text("profession"),
    domicile: text("domicile"),
    telephone: text("telephone"),
    pieceNature: text("piece_nature").notNull(),
    pieceNumero: text("piece_numero").notNull(),
    pieceDelivreeLe: date("piece_delivree_le"),
    provenance: text("provenance"),
    destination: text("destination"),
    userId: uuid("user_id"),

    ...timestamps,
  },
  (t) => [index("voyageurs_sejour_idx").on(t.sejourId), index("voyageurs_sejour_org_idx").on(t.organizationId, t.createdAt)],
);

export type MenageChambre = (typeof menageChambre.enumValues)[number];
export type NaturePrestation = (typeof naturePrestation.enumValues)[number];
export type SejourHotel = typeof sejoursHotel.$inferSelect;
