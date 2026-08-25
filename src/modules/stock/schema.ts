import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  money,
  primaryId,
  quantity,
  rowVersion,
  timestamps,
} from "@/db/schema/_shared";
import { organizations } from "@/db/schema/tenancy";
import { articles } from "@/modules/catalogue/schema";

/**
 * Nature du lieu de stockage.
 *
 * Le véhicule n'est pas une coquetterie : la vente ambulante et la tournée de
 * livraison chargent le camion le matin et le déchargent le soir. Sans lui, ce
 * stock-là reste attribué au dépôt et l'inventaire du soir ne tombe jamais
 * juste — on cherche pendant une heure des cartons qui roulent sur la route de
 * Bouaké.
 */
export const typeDepot = pgEnum("type_depot", ["depot", "magasin", "vehicule"]);

/**
 * Dépôt : l'endroit où la marchandise se trouve physiquement.
 *
 * Le stock se compte ICI, jamais sur l'article. Une entreprise qui tient un
 * dépôt à Yopougon et un magasin à Treichville a deux quantités distinctes
 * pour le même riz, et la question « en reste-t-il ? » n'a de réponse qu'une
 * fois le lieu précisé.
 */
export const depots = pgTable(
  "depots",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Référence courte, affichée partout : DEP-YOP, MAG-TRE. */
    code: text("code").notNull(),
    nom: text("nom").notNull(),

    type: typeDepot("type").notNull().default("depot"),

    ville: text("ville"),
    adresse: text("adresse"),

    /**
     * Dépôt proposé par défaut à la saisie. Un seul par entreprise — l'index
     * unique partiel plus bas l'impose en base, parce que deux dépôts « par
     * défaut » feraient dépendre la destination d'une réception de l'ordre de
     * tri du jour.
     */
    parDefaut: boolean("par_defaut").notNull().default(false),

    /**
     * Un dépôt ne se supprime pas tant qu'il porte des mouvements : il se
     * ferme. Il quitte les listes de saisie, son historique reste lisible.
     */
    actif: boolean("actif").notNull().default(true),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("depots_code_unique").on(t.organizationId, t.code),
    uniqueIndex("depots_defaut_unique")
      .on(t.organizationId)
      .where(sql`${t.parDefaut} AND ${t.deletedAt} IS NULL`),
    index("depots_org_idx").on(t.organizationId, t.actif),
  ],
);

/**
 * Nature du mouvement.
 *
 * La liste reprend celle des écrans : elle décrit d'où vient la marchandise ou
 * où elle va, pas le signe de la quantité — un même type peut jouer dans les
 * deux sens quand on contrepasse une erreur.
 */
export const typeMouvement = pgEnum("type_mouvement", [
  "reception",
  "vente",
  "transfert",
  "ajustement",
  "retour",
]);

/**
 * Mouvement de stock : la seule source de vérité sur les quantités.
 *
 * Il n'existe AUCUNE colonne « stock » ailleurs dans le schéma. Le stock d'un
 * article dans un dépôt est la somme des mouvements, et rien d'autre. Le
 * raisonnement est celui des encours tiers : un compteur tenu à côté des lignes
 * qui le composent finit toujours par diverger — il suffit d'une vente passée
 * sans décrément, d'un inventaire saisi en double, ou d'une synchronisation
 * hors connexion arrivée dans le désordre. Ici, la quantité est la conséquence
 * des lignes, donc elle est vraie par construction.
 *
 * Un mouvement est IMMUABLE. On ne corrige pas une ligne, on en enregistre une
 * autre qui l'annule. C'est ce qui rend l'inventaire explicable, et c'est aussi
 * ce qui rend la réplication hors connexion possible : une ligne qui ne change
 * jamais n'a pas de conflit à résoudre.
 *
 * Un transfert produit DEUX lignes — une sortie du dépôt d'origine, une entrée
 * au dépôt d'arrivée — reliées par `groupeId`. Le concurrent n'en enregistre
 * qu'une, en positif, ce qui crée des unités qui n'ont jamais existé.
 */
export const mouvementsStock = pgTable(
  "mouvements_stock",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    depotId: uuid("depot_id")
      .notNull()
      .references(() => depots.id, { onDelete: "restrict" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),

    type: typeMouvement("type").notNull(),

    /**
     * Quantité SIGNÉE, en millièmes d'unité de vente : positive à l'entrée,
     * négative à la sortie. Le signe porte le sens du mouvement, ce qui rend la
     * somme directe — pas de test sur le type pour savoir s'il faut ajouter ou
     * retrancher.
     */
    quantite: quantity("quantite").notNull(),

    /**
     * Prix de revient d'une unité au moment du mouvement, en francs entiers.
     *
     * Figé sur la ligne, et non lu sur l'article : le prix d'achat d'aujourd'hui
     * ne dit rien de ce qu'a coûté le stock reçu il y a trois mois. C'est cette
     * colonne qui rend la valorisation possible — à l'entrée, le prix payé ; à
     * la sortie, le coût moyen pondéré constaté à cet instant.
     */
    coutUnitaire: money("cout_unitaire").notNull().default(0),

    /**
     * Pièce à l'origine du mouvement : bon de réception, ticket, bon de
     * transfert, procès-verbal d'inventaire, avoir.
     *
     * Obligatoire, sans exception. Un écart de stock sans pièce ne remonte
     * jamais jusqu'à sa cause, et l'inventaire devient une opinion.
     */
    piece: text("piece").notNull(),

    /**
     * Rattachement à la pièce en base, quand elle y est. Vide aujourd'hui pour
     * les réceptions saisies à la main ; ce sont ces deux colonnes que la
     * Caisse et les ventes rempliront pour qu'un ticket retrouve ses sorties de
     * stock, et une sortie son ticket.
     */
    origineType: text("origine_type"),
    origineId: uuid("origine_id"),

    /** Autre dépôt d'un transfert. Sert à l'affichage « Yopougon → Adjamé ». */
    depotContrepartieId: uuid("depot_contrepartie_id").references(
      () => depots.id,
      { onDelete: "restrict" },
    ),

    /**
     * Relie les lignes d'une même opération : les deux moitiés d'un transfert,
     * les articles d'une même réception, les écarts d'un même inventaire.
     */
    groupeId: uuid("groupe_id"),

    /** Motif d'un ajustement ou d'un retour : casse, péremption, erreur de saisie. */
    motif: text("motif"),

    /** Auteur. Sans référence, comme le journal d'audit : un compte fermé ne doit pas effacer l'historique. */
    userId: uuid("user_id"),

    /**
     * Date d'effet, distincte de `created_at`. Une réception saisie le
     * lendemain matin porte la date du camion, pas celle de la saisie — et une
     * vente encaissée hors connexion garde l'heure de l'encaissement.
     */
    effectueLe: timestamp("effectue_le", { withTimezone: true })
      .notNull()
      .defaultNow(),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    /**
     * Un mouvement de quantité nulle ne bouge rien et pollue le journal. Le
     * signe, lui, n'est pas contraint : contrepasser une réception erronée
     * demande une réception négative, et l'interdire obligerait à maquiller la
     * correction en ajustement.
     */
    check("mouvements_stock_quantite_non_nulle", sql`${t.quantite} <> 0`),
    check("mouvements_stock_cout_positif", sql`${t.coutUnitaire} >= 0`),
    /**
     * Un transfert a toujours une contrepartie, et elle diffère du dépôt de la
     * ligne. Sans cela, un transfert « de Yopougon vers Yopougon » passerait, et
     * la marchandise disparaîtrait d'un côté sans réapparaître de l'autre.
     */
    check(
      "mouvements_stock_transfert_contrepartie",
      sql`(${t.type} <> 'transfert' AND ${t.depotContrepartieId} IS NULL)
          OR (${t.type} = 'transfert' AND ${t.depotContrepartieId} IS NOT NULL
              AND ${t.depotContrepartieId} <> ${t.depotId})`,
    ),
    /** Le calcul du stock : somme des quantités d'un article dans un dépôt. */
    index("mouvements_stock_solde_idx").on(
      t.organizationId,
      t.articleId,
      t.depotId,
    ),
    /** Le journal, du plus récent au plus ancien. */
    index("mouvements_stock_journal_idx").on(t.organizationId, t.effectueLe),
    index("mouvements_stock_groupe_idx").on(t.groupeId),
  ],
);

export type Depot = typeof depots.$inferSelect;
export type MouvementStock = typeof mouvementsStock.$inferSelect;
export type TypeMouvement = MouvementStock["type"];
export type TypeDepot = Depot["type"];
