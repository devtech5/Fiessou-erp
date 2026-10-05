import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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
import { commerciaux } from "@/modules/commerciaux/schema";
import { depots } from "@/modules/stock/schema";
import { tiers } from "@/modules/tiers/schema";

/**
 * Poste d'encaissement.
 *
 * UN POSTE, UN APPAREIL. Ce n'est pas une recommandation d'exploitation, c'est
 * ce qui rend la numérotation possible sans réseau : le compteur de tickets vit
 * sur l'appareil, qui est donc seul à l'avancer. Deux terminaux partageant le
 * même poste produiraient deux tickets numéro 42, et la contrainte d'unicité
 * plus bas refuserait le second — après que le client soit reparti avec son
 * reçu.
 *
 * `dernierNumero` est un MIROIR de ce que le serveur a vu passer, pas la
 * source. Il sert à recaler un appareil réinstallé, et à repérer un poste dont
 * les tickets n'ont pas été remontés.
 */
export const postesCaisse = pgTable(
  "postes_caisse",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    code: text("code").notNull(),
    nom: text("nom").notNull(),

    /**
     * Préfixe des tickets de ce poste : « C01- » donne « C01-000042 ».
     *
     * Il porte l'identité du point d'encaissement dans le numéro lui-même. Un
     * ticket ramené trois mois plus tard se rattache à sa caisse sans consulter
     * la base — ce qui compte quand le client conteste au comptoir.
     */
    prefixe: text("prefixe").notNull(),

    /** Dépôt qui fournit la marchandise vendue par ce poste. */
    depotId: uuid("depot_id")
      .notNull()
      .references(() => depots.id, { onDelete: "restrict" }),

    /** Dernier numéro reçu du terrain. Miroir, jamais la source. */
    dernierNumero: integer("dernier_numero").notNull().default(0),

    /** Appareil rattaché, tel que la session le connaît. */
    deviceId: text("device_id"),

    actif: boolean("actif").notNull().default(true),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    unique("postes_caisse_code_unique").on(t.organizationId, t.code),
    check("postes_caisse_numero_positif", sql`${t.dernierNumero} >= 0`),
    index("postes_caisse_org_idx").on(t.organizationId, t.actif),
  ],
);

export const statutVente = pgEnum("statut_vente", ["encaissee", "annulee"]);

/**
 * Nature d'une ligne de vente.
 *
 * `prestation` est le cas qui commande le modèle : un magasin de pièces
 * détachées vend une pièce, et le client demande qu'elle soit montée. Le
 * montage se facture en plus, sur son propre compte, et se rattache à la pièce.
 */
export const ligneVenteKind = pgEnum("ligne_vente_kind", [
  "article",
  "prestation",
  "frais",
]);

export const moyenReglement = pgEnum("moyen_reglement", [
  "especes",
  "mobile_money",
  "carte",
  "banque",
  "credit",
]);

/**
 * Vente encaissée.
 *
 * L'identifiant vient du CLIENT — au sens de l'appareil — et le numéro aussi.
 * Une vente encaissée sans réseau porte donc son identité définitive au moment
 * où le ticket sort de l'imprimante, et la synchronisation ne fait que
 * transporter ce qui existe déjà.
 *
 * Les totaux sont STOCKÉS, contrairement aux soldes tiers et aux quantités de
 * stock qui se déduisent. La différence est de nature : un solde est un état
 * courant, qui doit suivre ses lignes ; un ticket est un document ÉMIS, dont le
 * total a été imprimé, montré au client et encaissé. Le recalculer six mois
 * plus tard avec un prix ou un taux modifié entre-temps donnerait un montant
 * que personne n'a jamais payé.
 *
 * Une vente ne se modifie pas. Elle s'annule, et une autre la remplace — même
 * raison que pour les mouvements de stock, et même conséquence heureuse : rien
 * à résoudre quand deux appareils se synchronisent.
 */
export const ventes = pgTable(
  "ventes",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    caisseId: uuid("caisse_id")
      .notNull()
      .references(() => postesCaisse.id, { onDelete: "restrict" }),
    depotId: uuid("depot_id")
      .notNull()
      .references(() => depots.id, { onDelete: "restrict" }),

    /** Rang du ticket dans la suite du poste. Continu, sans trou. */
    numeroSeq: integer("numero_seq").notNull(),
    /** Numéro imprimé, préfixe compris : « C01-000042 ». */
    numero: text("numero").notNull(),

    /** Client identifié. Nul pour une vente au comptoir anonyme, le cas normal. */
    clientId: uuid("client_id").references(() => tiers.id, {
      onDelete: "set null",
    }),

    /**
     * Session de caisse à laquelle le ticket se rattache.
     *
     * Sans référence croisée : la session vit dans `schema-session.ts`, qui
     * pointe déjà vers le poste. La contrainte manquante est assumée — un
     * ticket peut naître hors session, notamment quand il remonte du hors-ligne
     * après la clôture, et le refuser ferait perdre une vente réelle.
     *
     * Nul aussi quand le caissier n'a pas ouvert de session : l'écran le
     * signale, mais bloquer la vente un samedi matin ferait revenir au cahier.
     */
    sessionCaisseId: uuid("session_caisse_id"),

    statut: statutVente("statut").notNull().default("encaissee"),

    /** Horodatage de l'encaissement, produit par la caisse. */
    encaisseeLe: timestamp("encaissee_le", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Somme des lignes avant remise. */
    totalBrut: money("total_brut").notNull().default(0),
    /** Remises de ligne et remise de pied cumulées. */
    totalRemise: money("total_remise").notNull().default(0),
    totalHt: money("total_ht").notNull().default(0),
    totalTva: money("total_tva").notNull().default(0),
    /** Ce que le client doit : c'est le montant imprimé sur le ticket. */
    totalTtc: money("total_ttc").notNull().default(0),

    /** Espèces remises par le client, pour retrouver la monnaie rendue. */
    especesRecues: money("especes_recues").notNull().default(0),
    monnaieRendue: money("monnaie_rendue").notNull().default(0),

    /** Appareil qui a encaissé. Sert au rattrapage et à l'écho de synchro. */
    deviceId: text("device_id"),
    userId: uuid("user_id"),
    /** Vendeur, quand ce n'est pas le caissier ; nul : le commercial lié au caissier. */
    commercialId: uuid("commercial_id").references(() => commerciaux.id, { onDelete: "set null" }),

    /** Motif d'annulation. Une annulation sans motif ne s'explique pas. */
    motifAnnulation: text("motif_annulation"),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    /**
     * Deux tickets ne peuvent pas porter le même rang sur le même poste. C'est
     * la contrainte qui rend le compteur local sûr : si deux appareils se
     * partagent un poste malgré la règle, le second est refusé en base plutôt
     * que d'écraser silencieusement le premier.
     */
    unique("ventes_numero_unique").on(t.organizationId, t.caisseId, t.numeroSeq),
    check("ventes_totaux_positifs", sql`${t.totalTtc} >= 0 AND ${t.totalBrut} >= 0`),
    check("ventes_numero_positif", sql`${t.numeroSeq} > 0`),
    check(
      "ventes_annulation_motivee",
      sql`${t.statut} <> 'annulee' OR ${t.motifAnnulation} IS NOT NULL`,
    ),
    index("ventes_org_date_idx").on(t.organizationId, t.encaisseeLe),
    index("ventes_org_client_idx").on(t.organizationId, t.clientId),
    index("ventes_caisse_idx").on(t.caisseId, t.numeroSeq),
  ],
);

/**
 * Ligne de vente.
 *
 * `parentLineId` porte le cas de la prestation rattachée : le montage facturé
 * avec la pièce détachée, l'installation du climatiseur, l'équilibrage du pneu,
 * la couture du tissu, le transport des matériaux sur le chantier. Ce n'est pas
 * un module, c'est une colonne — et une ligne fille disparaît avec sa mère,
 * parce qu'un montage sans pièce n'a pas de sens.
 *
 * La désignation et le prix sont RECOPIÉS depuis l'article, jamais lus par
 * jointure au moment de l'affichage : un ticket réimprimé six mois plus tard
 * doit dire ce qui a été vendu, à quel prix, même si l'article a changé de nom
 * ou a été archivé depuis.
 */
export const lignesVente = pgTable(
  "lignes_vente",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    venteId: uuid("vente_id")
      .notNull()
      .references(() => ventes.id, { onDelete: "cascade" }),

    /** Ligne mère. La fille tombe avec elle. */
    parentLineId: uuid("parent_line_id"),
    lineKind: ligneVenteKind("line_kind").notNull().default("article"),

    articleId: uuid("article_id").references(() => articles.id, {
      onDelete: "restrict",
    }),

    designation: text("designation").notNull(),
    /** En millièmes d'unité de vente. */
    quantite: quantity("quantite").notNull(),
    unite: text("unite").notNull().default("piece"),

    prixUnitaire: money("prix_unitaire").notNull().default(0),
    /** Remise de ligne en francs entiers, jamais un pourcentage stocké. */
    remise: money("remise").notNull().default(0),

    /** Taux appliqué, en POINTS DE BASE : 1800 = 18 %. */
    tauxTva: integer("taux_tva").notNull().default(0),
    montantHt: money("montant_ht").notNull().default(0),
    montantTva: money("montant_tva").notNull().default(0),

    /** Compte de produit : 701 marchandise, 706 service. */
    compteVente: text("compte_vente").notNull().default("701"),

    /**
     * Coût de revient à l'instant de la vente, pour UNE unité. Figé sur la
     * ligne : sans lui la marge réelle de l'opération se perd dès que le prix
     * d'achat bouge.
     */
    coutUnitaire: money("cout_unitaire").notNull().default(0),

    /**
     * Exécutant de la prestation, et ce qu'elle coûte en main-d'œuvre. Le
     * tâcheron qui monte la pièce est payé à la tâche : sans ces deux colonnes,
     * la marge de l'opération est fausse de tout son travail.
     */
    workerId: uuid("worker_id"),
    coutMainOeuvre: money("cout_main_oeuvre").notNull().default(0),

    ordre: integer("ordre").notNull().default(0),

    ...timestamps,
    ...rowVersion,
  },
  (t) => [
    check("lignes_vente_quantite_positive", sql`${t.quantite} > 0`),
    check(
      "lignes_vente_montants_positifs",
      sql`${t.prixUnitaire} >= 0 AND ${t.remise} >= 0 AND ${t.montantHt} >= 0`,
    ),
    check("lignes_vente_taux_borne", sql`${t.tauxTva} >= 0 AND ${t.tauxTva} <= 10000`),
    /** Une prestation pointe toujours vers un article de type service. */
    index("lignes_vente_vente_idx").on(t.venteId, t.ordre),
    index("lignes_vente_article_idx").on(t.organizationId, t.articleId),
    index("lignes_vente_parent_idx").on(t.parentLineId),
  ],
);

/**
 * Règlement d'une vente.
 *
 * Plusieurs lignes par ticket, parce que le paiement mixte est la norme et non
 * l'exception : la moitié en espèces, le reste en mobile money, et le solde à
 * crédit pour le client connu. Un champ unique « moyen de paiement » obligerait
 * le caissier à mentir sur ce qu'il a réellement reçu — et la caisse ne
 * tomberait pas juste le soir.
 */
export const reglementsVente = pgTable(
  "reglements_vente",
  {
    id: primaryId(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    venteId: uuid("vente_id")
      .notNull()
      .references(() => ventes.id, { onDelete: "cascade" }),

    moyen: moyenReglement("moyen").notNull(),
    montant: money("montant").notNull(),

    /** Référence de la transaction : numéro mobile money, bordereau, ticket carte. */
    reference: text("reference"),

    ordre: integer("ordre").notNull().default(0),

    ...timestamps,
  },
  (t) => [
    check("reglements_vente_montant_positif", sql`${t.montant} > 0`),
    index("reglements_vente_vente_idx").on(t.venteId),
    index("reglements_vente_org_moyen_idx").on(t.organizationId, t.moyen),
  ],
);

export type PosteCaisse = typeof postesCaisse.$inferSelect;
export type Vente = typeof ventes.$inferSelect;
export type LigneVente = typeof lignesVente.$inferSelect;
export type ReglementVente = typeof reglementsVente.$inferSelect;
export type MoyenReglementVente = ReglementVente["moyen"];
export type LineKind = LigneVente["lineKind"];
