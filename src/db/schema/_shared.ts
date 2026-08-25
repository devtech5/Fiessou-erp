import { bigint, char, integer, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Identifiants. UUID v4 par défaut côté serveur, mais le client PEUT fournir
 * l'identifiant : c'est ce qui permet de créer une vente hors connexion et de
 * la synchroniser plus tard sans réattribution d'identifiant.
 */
export const primaryId = () => uuid("id").primaryKey().defaultRandom();

/**
 * Montants monétaires. Toujours des ENTIERS, dans la plus petite unité de la
 * devise — pour le franc CFA, l'unité est le franc lui-même (exposant 0).
 *
 * Ne jamais utiliser de flottant pour de l'argent. Le concurrent affiche
 * « 2 990,841 FCFA » comme ticket moyen faute d'avoir tenu cette règle.
 *
 * Le mode "number" est sûr ici : un entier JavaScript reste exact jusqu'à
 * 2^53, soit plus de 9 millions de milliards de francs.
 */
export const money = (name: string) => bigint(name, { mode: "number" });

/** Code ISO 4217 : XOF, XAF, EUR… */
export const currencyCode = (name = "currency") => char(name, { length: 3 });

/**
 * Quantités. Entiers eux aussi, en MILLIÈMES d'unité de vente.
 *
 *   1,340 kg -> 1340       2 pièces -> 2000       0,5 L -> 500
 *
 * Le raisonnement est celui des montants : un nombre à virgule dérive. Sur une
 * ligne isolée cela ne se voit pas ; sur un stock qui accumule des milliers de
 * mouvements, la dérive produit un inventaire faux et inexplicable.
 *
 * Une poissonnerie vend au poids, un dépôt de gaz à la bouteille, un chantier
 * au mètre carré : l'unité vit sur l'article, et `src/lib/quantite.ts` sait
 * lesquelles acceptent une fraction. Ne jamais écrire une quantité en virgule
 * flottante dans ces colonnes.
 */
export const quantity = (name: string) => bigint(name, { mode: "number" });

/** Horodatages communs à toute table persistée. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Suppression logique : une ligne effacée doit pouvoir se répliquer. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

/**
 * Compteur de révision, incrémenté à chaque écriture. Sert à détecter les
 * conflits quand deux appareils modifient la même ligne hors connexion.
 */
export const rowVersion = {
  version: integer("version").notNull().default(1),
};
