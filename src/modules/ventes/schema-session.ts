import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { money, primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { moyenReglement, postesCaisse } from "./schema";

export const statutSessionCaisse = pgEnum("statut_session_caisse", [
  "ouverte",
  "cloturee",
]);

/**
 * Session de caisse : d'une ouverture à un comptage.
 *
 * C'est ce qui manquait pour que la caisse serve à autre chose qu'encaisser.
 * Le journal des ventes dit ce qui est ENTRÉ ; seule la session dit ce qu'il
 * devrait y avoir dans le tiroir, et donc s'il y est.
 *
 * Un écart de caisse non détecté est le premier vol d'un commerce, et le
 * second est celui qu'on découvre trop tard pour savoir de quel jour il date.
 * D'où une session par journée et par caissier, bornée par un fond initial et
 * un comptage.
 *
 * La période n'est PAS la journée civile. Un maquis ferme à deux heures du
 * matin : compter « les ventes du 25 » y couperait la soirée en deux et
 * produirait deux écarts inexplicables au lieu d'un total juste.
 */
export const sessionsCaisse = pgTable(
  "sessions_caisse",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    caisseId: uuid("caisse_id")
      .notNull()
      .references(() => postesCaisse.id, { onDelete: "restrict" }),

    /** Caissier responsable du tiroir. C'est à lui que l'écart se rapporte. */
    userId: uuid("user_id"),
    /** Nom recopié : un compte fermé ne doit pas effacer qui tenait la caisse. */
    caissier: text("caissier").notNull(),

    statut: statutSessionCaisse("statut").notNull().default("ouverte"),

    /**
     * Monnaie déposée dans le tiroir à l'ouverture, pour rendre la monnaie.
     * Elle n'est ni un produit ni un encaissement : la compter comme une
     * recette gonflerait la journée du montant du fond, chaque jour.
     */
    fondInitial: money("fond_initial").notNull().default(0),

    ouverteLe: timestamp("ouverte_le", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clotureeLe: timestamp("cloturee_le", { withTimezone: true }),

    /** Somme des écarts constatés, signée. Négative : il manque. */
    ecart: money("ecart").notNull().default(0),
    /** Obligatoire dès qu'un écart existe : un manque sans explication se répète. */
    motifEcart: text("motif_ecart"),

    notes: text("notes"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    /**
     * Une seule session ouverte par poste. Deux tiroirs ouverts sur la même
     * caisse rendent tout comptage impossible : personne ne sait à laquelle
     * rattacher la vente de 14 h.
     */
    uniqueIndex("sessions_caisse_ouverte_unique")
      .on(t.caisseId)
      .where(sql`${t.statut} = 'ouverte' AND ${t.deletedAt} IS NULL`),
    check("sessions_caisse_fond_positif", sql`${t.fondInitial} >= 0`),
    check(
      "sessions_caisse_cloture_datee",
      sql`(${t.statut} = 'ouverte' AND ${t.clotureeLe} IS NULL)
          OR (${t.statut} = 'cloturee' AND ${t.clotureeLe} IS NOT NULL)`,
    ),
    index("sessions_caisse_org_idx").on(t.organizationId, t.ouverteLe),
  ],
);

/**
 * Comptage d'un moyen de règlement à la clôture.
 *
 * Une ligne par moyen, et non un total unique : le tiroir se compare aux
 * espèces, le relevé de l'opérateur au mobile money, le bordereau à la carte.
 * Un chiffre global ne se vérifie contre rien — il additionne ce qui se compte
 * à la main et ce qui se lit sur un écran.
 *
 * `attendu` est FIGÉ au moment de la clôture. Le recalculer plus tard donnerait
 * un autre chiffre dès qu'un ticket en retard remonte du hors-ligne, et
 * l'écart constaté ce soir-là deviendrait irretrouvable.
 */
export const comptagesCaisse = pgTable(
  "comptages_caisse",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsCaisse.id, { onDelete: "cascade" }),

    moyen: moyenReglement("moyen").notNull(),

    /** Ce que les ventes de la session ont encaissé par ce moyen. */
    attendu: money("attendu").notNull().default(0),
    /** Ce que le caissier a réellement compté. */
    compte: money("compte").notNull().default(0),
    /** `compte - attendu`. Négatif : il manque. */
    ecart: money("ecart").notNull().default(0),

    ...timestamps,
  },
  (t) => [
    index("comptages_caisse_session_idx").on(t.sessionId),
    index("comptages_caisse_org_idx").on(t.organizationId, t.moyen),
  ],
);

export type SessionCaisse = typeof sessionsCaisse.$inferSelect;
export type ComptageCaisse = typeof comptagesCaisse.$inferSelect;
