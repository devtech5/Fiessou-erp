import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
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
import { tiers } from "@/modules/tiers/schema";
import type { CodeUnite } from "@/lib/quantite";

/**
 * Grandeurs de vente. La liste reflète `UNITES` dans `src/lib/quantite.ts` —
 * `satisfies` fait échouer la compilation si les deux divergent, plutôt que de
 * laisser passer une unité que la base refusera à l'insertion.
 */
export const codeUnite = pgEnum("code_unite", [
  "piece",
  "kg",
  "g",
  "l",
  "ml",
  "m",
  "m2",
  "m3",
  "heure",
  "jour",
] as const satisfies readonly CodeUnite[]);

/**
 * Nature de l'article.
 *
 * La distinction n'est pas cosmétique : une marchandise se ventile en 701, un
 * service en 706, et leur régime de TVA peut différer. C'est aussi elle qui
 * rend possible la ligne de prestation rattachée à une pièce vendue — le
 * montage facturé avec la pièce détachée pointe vers un article de type
 * service, avec son prix et son compte propres.
 */
export const typeArticle = pgEnum("type_article", ["marchandise", "service"]);

/**
 * Famille d'articles.
 *
 * Elle porte les valeurs par défaut de ses articles : compte de vente, compte
 * d'achat, taux de TVA. Sans elle, chaque création d'article redemanderait
 * trois informations comptables à quelqu'un qui vend du savon.
 */
export const famillesArticle = pgTable(
  "familles_article",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    code: text("code").notNull(),
    nom: text("nom").notNull(),

    /** Compte SYSCOHADA de produit : 701 marchandises, 706 services. */
    compteVente: text("compte_vente").notNull().default("701"),
    /** Compte de charge : 601 achats de marchandises. */
    compteAchat: text("compte_achat").notNull().default("601"),

    /**
     * Taux de TVA en POINTS DE BASE : 1800 = 18 %, 0 = exonéré.
     *
     * Entier, comme tout le reste. Le taux normal ivoirien tombe juste, mais
     * pas tous : un taux réduit à 9 %, une taxe spécifique à 2,5 % ou un
     * prélèvement à 0,5 % s'écriraient en virgule flottante et dériveraient sur
     * le cumul d'une déclaration.
     */
    tauxTva: integer("taux_tva").notNull().default(1800),

    ordre: integer("ordre").notNull().default(0),
    actif: boolean("actif").notNull().default(true),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("familles_article_code_unique").on(t.organizationId, t.code),
    check("familles_article_taux_borne", sql`${t.tauxTva} >= 0 AND ${t.tauxTva} <= 10000`),
    index("familles_article_org_idx").on(t.organizationId),
  ],
);

/** Un axe de déclinaison : « Taille » → 38, 39, 40 ; « Couleur » → Noir, Blanc. */
export interface AxeVariante {
  nom: string;
  valeurs: string[];
}

/**
 * Modèle à variantes : la chaussure « Derby cuir », déclinée en tailles et en
 * couleurs. Le modèle ne se vend pas et ne se stocke pas : chaque déclinaison
 * est un ARTICLE à part entière — sa référence, son stock, son prix, son code-
 * barres —, rattaché ici par `articles.modele_id`. La caisse, le stock, les
 * factures et les achats ne connaissent que des articles ; rien n'y change.
 */
export const modelesArticle = pgTable(
  "modeles_article",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    familleId: uuid("famille_id").references(() => famillesArticle.id, { onDelete: "set null" }),
    /** Racine des références des variantes : DERBY → DERBY-42-NOIR. */
    reference: text("reference").notNull(),
    designation: text("designation").notNull(),
    unite: codeUnite("unite").notNull().default("piece"),
    /** Prix proposés aux nouvelles variantes ; chacune peut ensuite s'en écarter. */
    prixVente: money("prix_vente").notNull().default(0),
    prixAchat: money("prix_achat").notNull().default(0),
    tauxTva: integer("taux_tva"),
    seuilAlerte: quantity("seuil_alerte").notNull().default(0),
    fournisseurId: uuid("fournisseur_id").references(() => tiers.id, { onDelete: "set null" }),
    axes: jsonb("axes").$type<AxeVariante[]>().notNull(),
    actif: boolean("actif").notNull().default(true),
    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("modeles_article_reference_unique").on(t.organizationId, t.reference),
    check("modeles_article_prix", sql`${t.prixVente} >= 0 AND ${t.prixAchat} >= 0`),
  ],
);

/**
 * Article : tout ce qui se vend, se stocke ou se facture.
 *
 * Cette table ne porte AUCUNE quantité en stock. Le stock est la somme des
 * mouvements, et il se compte par dépôt : une colonne unique deviendrait fausse
 * dès la deuxième boutique, et se désynchroniserait au premier mouvement
 * enregistré hors connexion. Le module Stock l'apportera.
 */
export const articles = pgTable(
  "articles",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    familleId: uuid("famille_id").references(() => famillesArticle.id, {
      onDelete: "set null",
    }),

    /** Référence interne : SKU, code rayon. Distincte des codes scannables. */
    reference: text("reference").notNull(),
    designation: text("designation").notNull(),

    type: typeArticle("type").notNull().default("marchandise"),

    /**
     * Grandeur mesurée : elle décide si l'article accepte une fraction. Le
     * conditionnement, lui, n'est qu'un libellé d'affichage — « sac »,
     * « bouteille », « carton » ne sont pas des grandeurs, on ne pèse pas en sacs.
     */
    unite: codeUnite("unite").notNull().default("piece"),
    conditionnement: text("conditionnement"),

    /** Prix de vente d'UNE unité de vente : la pièce, ou le kilo. En francs entiers. */
    prixVente: money("prix_vente").notNull().default(0),
    /** Dernier prix d'achat connu. Sert à la marge et au réapprovisionnement. */
    prixAchat: money("prix_achat").notNull().default(0),

    /** Nuls : l'article suit sa famille. Renseignés : il s'en écarte. */
    tauxTva: integer("taux_tva"),
    compteVente: text("compte_vente"),
    compteAchat: text("compte_achat"),

    /** Un service ne se stocke pas. Une prestation de montage non plus. */
    suiviStock: boolean("suivi_stock").notNull().default(true),
    /** Seuil d'alerte, en millièmes d'unité — dans l'unité de l'article. */
    seuilAlerte: quantity("seuil_alerte").notNull().default(0),

    /** Fournisseur habituel : c'est lui que propose le réapprovisionnement. */
    fournisseurId: uuid("fournisseur_id").references(() => tiers.id, {
      onDelete: "set null",
    }),

    /** Modèle dont l'article est une déclinaison ; nul pour un article simple. */
    modeleId: uuid("modele_id").references(() => modelesArticle.id, { onDelete: "set null" }),
    /** Valeur de chaque axe du modèle : { Taille: "42", Couleur: "Noir" }. */
    attributs: jsonb("attributs").$type<Record<string, string>>(),

    /**
     * Un article ne se supprime pas tant qu'il figure sur une pièce vendue :
     * il se désactive. Il quitte la caisse, l'historique reste lisible.
     */
    actif: boolean("actif").notNull().default(true),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("articles_reference_unique").on(t.organizationId, t.reference),
    check(
      "articles_prix_positifs",
      sql`${t.prixVente} >= 0 AND ${t.prixAchat} >= 0 AND ${t.seuilAlerte} >= 0`,
    ),
    check(
      "articles_taux_borne",
      sql`${t.tauxTva} IS NULL OR (${t.tauxTva} >= 0 AND ${t.tauxTva} <= 10000)`,
    ),
    /**
     * Un service stocké n'existe pas. La contrainte est en base parce que
     * l'inverse produirait un inventaire d'heures de main-d'œuvre.
     */
    check(
      "articles_service_non_stocke",
      sql`${t.type} <> 'service' OR ${t.suiviStock} = false`,
    ),
    index("articles_org_designation_idx").on(t.organizationId, t.designation),
    index("articles_org_famille_idx").on(t.organizationId, t.familleId),
    index("articles_org_fournisseur_idx").on(t.organizationId, t.fournisseurId),
    // Une combinaison n'existe qu'une fois par modèle : pas deux « 42 Noir ».
    uniqueIndex("articles_modele_attributs_unique").on(t.modeleId, t.attributs).where(sql`${t.modeleId} IS NOT NULL`),
  ],
);

export type Article = typeof articles.$inferSelect;
export type ModeleArticle = typeof modelesArticle.$inferSelect;
export type FamilleArticle = typeof famillesArticle.$inferSelect;
