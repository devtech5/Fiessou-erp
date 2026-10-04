import { sql } from "drizzle-orm";
import { bigint, char, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { primaryId, rowVersion, timestamps } from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";

/**
 * Archives numériques.
 *
 * Chaque utilisateur dispose d'un espace où il dépose ce qu'il doit conserver :
 * contrats signés reçus par message, captures, relevés, exports, photos. Ce
 * n'est pas la bibliothèque de Documents, qui rattache une pièce à un client ou
 * à un véhicule : ici, la pièce appartient à la personne qui l'a déposée, et
 * l'administrateur légal de l'entreprise peut la consulter.
 *
 * Une archive ne se modifie pas. Elle porte l'empreinte SHA-256 de son
 * fichier, prise au dépôt, qui permet d'en prouver l'intégrité plus tard.
 */
export const archives = pgTable(
  "archives",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Numéro séquentiel : ARC-2026-00042. */
    numero: text("numero").notNull(),
    /** Auteur et titulaire de l'archive. */
    userId: uuid("user_id").notNull(),

    titre: text("titre").notNull(),
    /** Classement libre : Contrats, Banque, Fiscal, Correspondance. */
    dossier: text("dossier"),
    description: text("description"),

    chemin: text("chemin").notNull(),
    nomFichier: text("nom_fichier").notNull(),
    typeMime: text("type_mime").notNull(),
    tailleOctets: bigint("taille_octets", { mode: "number" }).notNull(),
    empreinte: char("empreinte", { length: 64 }).notNull(),

    /**
     * Retrait par l'auteur, dans le délai de correction. L'archive disparaît de
     * son espace mais reste conservée et visible de l'administrateur légal :
     * un retrait masque, il n'efface pas.
     */
    retireeLe: timestamp("retiree_le", { withTimezone: true }),
    motifRetrait: text("motif_retrait"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("archives_numero_unique").on(t.organizationId, t.numero),
    unique("archives_chemin_unique").on(t.organizationId, t.chemin),
    check("archives_taille_positive", sql`${t.tailleOctets} > 0`),
    check("archives_retrait_motive", sql`${t.retireeLe} IS NULL OR ${t.motifRetrait} IS NOT NULL`),
    index("archives_titulaire_idx").on(t.organizationId, t.userId, t.createdAt),
  ],
);

export type Archive = typeof archives.$inferSelect;
