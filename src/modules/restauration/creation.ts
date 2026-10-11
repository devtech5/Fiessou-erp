import "server-only";

import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { estDoublon } from "@/lib/erreurs-pg";
import { newId } from "@/lib/ids";
import { prochainNumero, type Transaction } from "@/lib/sequences";
import { articles } from "@/modules/catalogue/schema";
import {
  creerPosteCaisseDans,
  enregistrerVenteDans,
  type ReglementAEnregistrer,
  type ResultatVente,
} from "@/modules/ventes/creation";
import { postesCaisse } from "@/modules/ventes/schema";

import { ESPACES, passagePermis, type Espace, type Etat, type Poste } from "./calcul";
import { commandesSalle, lignesCommandeSalle, tablesSalle } from "./schema";

async function tracer(
  tx: Transaction,
  organizationId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  after: Record<string, unknown>,
) {
  await tx.insert(auditLogs).values({ id: newId(), organizationId, userId, action, entityType, entityId, after });
}

// ------------------------------------------------------------------- tables

export interface NouvelleTable {
  espace: Espace;
  nom: string;
  zone?: string | null;
  places?: number | null;
  ordre?: number;
}

export async function creerTablePour(organizationId: string, saisie: NouvelleTable, userId: string): Promise<string> {
  const nom = saisie.nom.trim();
  if (nom.length === 0) throw new Error("Indiquez le nom de la table.");

  return db.transaction(async (tx) => {
    const id = newId();
    try {
      await tx.insert(tablesSalle).values({
        id,
        organizationId,
        espace: saisie.espace,
        nom,
        zone: saisie.zone?.trim() || null,
        places: saisie.places ?? null,
        ordre: saisie.ordre ?? 0,
      });
    } catch (erreur) {
      if (estDoublon(erreur)) throw new Error(`La table « ${nom} » existe déjà.`);
      throw erreur;
    }
    await tracer(tx, organizationId, userId, "table_salle.creer", "table_salle", id, { espace: saisie.espace, nom });
    return id;
  });
}

/**
 * Sort une table du plan de salle, ou l'y remet.
 *
 * Refusé tant qu'une commande y est ouverte : la table disparaîtrait du plan
 * avec une addition en cours, que plus personne ne retrouverait.
 */
export async function basculerTablePour(organizationId: string, userId: string, tableId: string, actif: boolean): Promise<void> {
  await db.transaction(async (tx) => {
    if (!actif) {
      const [ouverte] = await tx
        .select({ numero: commandesSalle.numero })
        .from(commandesSalle)
        .where(
          and(
            eq(commandesSalle.organizationId, organizationId),
            eq(commandesSalle.tableId, tableId),
            eq(commandesSalle.statut, "ouverte"),
            isNull(commandesSalle.deletedAt),
          ),
        );
      if (ouverte) throw new Error(`La commande ${ouverte.numero} est ouverte sur cette table : encaissez-la d'abord.`);
    }

    const [table] = await tx
      .update(tablesSalle)
      .set({ actif, updatedAt: new Date(), version: sql`${tablesSalle.version} + 1` })
      .where(and(eq(tablesSalle.id, tableId), eq(tablesSalle.organizationId, organizationId)))
      .returning({ nom: tablesSalle.nom });
    if (!table) throw new Error("Table introuvable.");
    await tracer(tx, organizationId, userId, actif ? "table_salle.activer" : "table_salle.retirer", "table_salle", tableId, { nom: table.nom });
  });
}

// ---------------------------------------------------------------- commandes

export interface NouvelleCommande {
  espace: Espace;
  tableId?: string | null;
  libelle?: string | null;
  couverts?: number | null;
}

/**
 * Ouvre la commande d'une table, ou rend celle qui y est déjà ouverte.
 *
 * Deux serveurs qui touchent la même table se retrouvent sur la même
 * addition : c'est ce qu'ils attendent, et l'index unique le garantit même
 * quand ils appuient à la même seconde.
 */
export async function ouvrirCommandePour(
  organizationId: string,
  saisie: NouvelleCommande,
  userId: string,
  maintenant = new Date(),
): Promise<{ id: string; numero: string; existante: boolean }> {
  const tableId = saisie.tableId ?? null;
  if (!tableId && !saisie.libelle?.trim()) {
    throw new Error("Une commande à emporter porte un nom : celui du client, ou un repère.");
  }

  const dejaOuverte = async () => {
    if (!tableId) return null;
    const [commande] = await db
      .select({ id: commandesSalle.id, numero: commandesSalle.numero })
      .from(commandesSalle)
      .where(
        and(
          eq(commandesSalle.organizationId, organizationId),
          // L'espace aussi : un serveur du restaurant ne doit pas retrouver,
          // par l'identifiant d'une table, l'addition d'une table du maquis.
          eq(commandesSalle.espace, saisie.espace),
          eq(commandesSalle.tableId, tableId),
          eq(commandesSalle.statut, "ouverte"),
          isNull(commandesSalle.deletedAt),
        ),
      );
    return commande ?? null;
  };

  const existante = await dejaOuverte();
  if (existante) return { ...existante, existante: true };

  try {
    return await db.transaction(async (tx) => {
      if (tableId) {
        const [table] = await tx
          .select({ espace: tablesSalle.espace, actif: tablesSalle.actif, nom: tablesSalle.nom })
          .from(tablesSalle)
          .where(and(eq(tablesSalle.id, tableId), eq(tablesSalle.organizationId, organizationId)));
        if (!table || table.espace !== saisie.espace) throw new Error("Table introuvable.");
        if (!table.actif) throw new Error(`La table « ${table.nom} » est retirée du plan de salle.`);
      }

      const annee = String(maintenant.getFullYear());
      const numero = await prochainNumero(tx, organizationId, {
        cle: `commande_salle:${saisie.espace}`,
        prefix: `${ESPACES[saisie.espace].prefixe}-${annee}-`,
        padding: 5,
        periode: annee,
      });

      const id = newId();
      await tx.insert(commandesSalle).values({
        id,
        organizationId,
        espace: saisie.espace,
        numero,
        tableId,
        libelle: saisie.libelle?.trim() || null,
        couverts: saisie.couverts ?? null,
        serveurId: userId,
        ouverteLe: maintenant,
      });
      await tracer(tx, organizationId, userId, "commande_salle.ouvrir", "commande_salle", id, { numero, table: tableId });
      return { id, numero, existante: false };
    });
  } catch (erreur) {
    // Ouverte par un autre serveur entre la lecture et l'écriture.
    if (estDoublon(erreur)) {
      const concurrente = await dejaOuverte();
      if (concurrente) return { ...concurrente, existante: true };
    }
    throw erreur;
  }
}

async function commandeOuverte(tx: Transaction, organizationId: string, commandeId: string, verrouiller = false) {
  const requete = tx
    .select()
    .from(commandesSalle)
    .where(
      and(eq(commandesSalle.id, commandeId), eq(commandesSalle.organizationId, organizationId), isNull(commandesSalle.deletedAt)),
    );
  const [commande] = verrouiller ? await requete.for("update") : await requete;
  if (!commande) throw new Error("Commande introuvable.");
  if (commande.statut === "encaissee") throw new Error(`La commande ${commande.numero} est déjà encaissée.`);
  if (commande.statut === "annulee") throw new Error(`La commande ${commande.numero} est annulée.`);
  return commande;
}

export interface LigneAEnvoyer {
  /** Produit par l'appareil du serveur : un double envoi ne double pas le plat. */
  id: string;
  articleId: string;
  /** Millièmes d'unité. */
  quantite: number;
  note?: string | null;
  poste: Poste;
}

/**
 * Envoie des lignes en cuisine et au bar.
 *
 * Le prix et la désignation viennent de l'article, au moment de l'envoi :
 * l'appareil du serveur dit QUOI et COMBIEN, jamais à quel prix — sans quoi
 * n'importe qui ferait sa propre carte depuis les outils du navigateur.
 *
 * IDEMPOTENT par identifiant de ligne : un réseau qui hoquette au maquis fait
 * renvoyer la tournée, il ne doit pas la servir deux fois.
 */
export async function envoyerLignesPour(
  organizationId: string,
  userId: string,
  commandeId: string,
  lignes: LigneAEnvoyer[],
  maintenant = new Date(),
): Promise<{ envoyees: number }> {
  if (lignes.length === 0) throw new Error("Rien à envoyer.");

  return db.transaction(async (tx) => {
    const commande = await commandeOuverte(tx, organizationId, commandeId, true);

    const deja = await tx
      .select({ id: lignesCommandeSalle.id })
      .from(lignesCommandeSalle)
      .where(
        and(
          eq(lignesCommandeSalle.organizationId, organizationId),
          inArray(
            lignesCommandeSalle.id,
            lignes.map((l) => l.id),
          ),
        ),
      );
    const connues = new Set(deja.map((l) => l.id));
    const nouvelles = lignes.filter((l) => !connues.has(l.id));
    if (nouvelles.length === 0) return { envoyees: 0 };

    const references = await tx
      .select({
        id: articles.id,
        designation: articles.designation,
        prixVente: articles.prixVente,
        actif: articles.actif,
      })
      .from(articles)
      .where(
        and(
          eq(articles.organizationId, organizationId),
          inArray(
            articles.id,
            nouvelles.map((l) => l.articleId),
          ),
        ),
      );
    const parId = new Map(references.map((a) => [a.id, a]));

    const [{ dernier }] = await tx
      .select({ dernier: max(lignesCommandeSalle.ordre) })
      .from(lignesCommandeSalle)
      .where(eq(lignesCommandeSalle.commandeId, commandeId));
    let ordre = (dernier ?? -1) + 1;

    for (const ligne of nouvelles) {
      const article = parId.get(ligne.articleId);
      if (!article || !article.actif) throw new Error("Un article de la commande n'est plus à la carte.");
      if (!Number.isInteger(ligne.quantite) || ligne.quantite <= 0) throw new Error(`Quantité invalide pour « ${article.designation} ».`);

      await tx.insert(lignesCommandeSalle).values({
        id: ligne.id,
        organizationId,
        commandeId,
        articleId: article.id,
        designation: article.designation,
        quantite: ligne.quantite,
        prixUnitaire: article.prixVente,
        note: ligne.note?.trim() || null,
        poste: ligne.poste,
        envoyeeLe: maintenant,
        userId,
        ordre: ordre++,
      });
    }

    await tx
      .update(commandesSalle)
      .set({ updatedAt: maintenant, version: sql`${commandesSalle.version} + 1` })
      .where(eq(commandesSalle.id, commandeId));
    await tracer(tx, organizationId, userId, "commande_salle.envoyer", "commande_salle", commandeId, {
      numero: commande.numero,
      lignes: nouvelles.length,
    });
    return { envoyees: nouvelles.length };
  });
}

/**
 * Fait avancer des lignes : prêtes en cuisine, servies en salle.
 *
 * Une ligne qui ne peut pas faire ce pas — déjà servie, annulée entre-temps
 * par le serveur — est laissée telle quelle plutôt que de faire échouer tout
 * le bon : le cuisinier qui marque six plats prêts ne doit pas recommencer
 * parce qu'un septième a été annulé pendant ce temps.
 */
export async function avancerLignesPour(
  organizationId: string,
  userId: string,
  espace: Espace,
  ligneIds: string[],
  vers: "prete" | "servie",
  maintenant = new Date(),
): Promise<{ avancees: number }> {
  if (ligneIds.length === 0) return { avancees: 0 };

  return db.transaction(async (tx) => {
    // La commande peut être déjà encaissée : au maquis, on paie souvent la
    // tournée avant qu'elle arrive. La cuisine la sert quand même. L'espace,
    // lui, est filtré : les droits se donnent espace par espace.
    const lignes = await tx
      .select({ id: lignesCommandeSalle.id, etat: lignesCommandeSalle.etat, commandeId: lignesCommandeSalle.commandeId })
      .from(lignesCommandeSalle)
      .innerJoin(commandesSalle, eq(commandesSalle.id, lignesCommandeSalle.commandeId))
      .where(
        and(
          eq(lignesCommandeSalle.organizationId, organizationId),
          eq(commandesSalle.espace, espace),
          inArray(lignesCommandeSalle.id, ligneIds),
        ),
      );

    const eligibles = lignes.filter((l) => passagePermis(l.etat as Etat, vers)).map((l) => l.id);
    if (eligibles.length === 0) return { avancees: 0 };

    await tx
      .update(lignesCommandeSalle)
      .set({
        etat: vers,
        ...(vers === "prete" ? { preteLe: maintenant } : { servieLe: maintenant }),
        updatedAt: maintenant,
        version: sql`${lignesCommandeSalle.version} + 1`,
      })
      .where(inArray(lignesCommandeSalle.id, eligibles));

    await tracer(tx, organizationId, userId, vers === "prete" ? "ligne_salle.prete" : "ligne_salle.servie", "commande_salle", lignes[0].commandeId, {
      lignes: eligibles.length,
    });
    return { avancees: eligibles.length };
  });
}

/** Annule une ligne envoyée. Elle reste au dossier, avec son motif, et ne se facture plus. */
export async function annulerLignePour(
  organizationId: string,
  userId: string,
  ligneId: string,
  motif: string,
): Promise<void> {
  const raison = motif.trim();
  if (raison.length < 3) throw new Error("Indiquez pourquoi la ligne est annulée.");

  await db.transaction(async (tx) => {
    const [ligne] = await tx
      .select({ commandeId: lignesCommandeSalle.commandeId, etat: lignesCommandeSalle.etat, designation: lignesCommandeSalle.designation })
      .from(lignesCommandeSalle)
      .where(and(eq(lignesCommandeSalle.id, ligneId), eq(lignesCommandeSalle.organizationId, organizationId)));
    if (!ligne) throw new Error("Ligne introuvable.");
    await commandeOuverte(tx, organizationId, ligne.commandeId, true);
    if (!passagePermis(ligne.etat as Etat, "annulee")) throw new Error("Cette ligne est déjà annulée.");

    await tx
      .update(lignesCommandeSalle)
      .set({ etat: "annulee", motifAnnulation: raison, updatedAt: new Date(), version: sql`${lignesCommandeSalle.version} + 1` })
      .where(eq(lignesCommandeSalle.id, ligneId));
    await tracer(tx, organizationId, userId, "ligne_salle.annuler", "commande_salle", ligne.commandeId, { designation: ligne.designation, motif: raison });
  });
}

/** Annule toute une commande : le client est parti sans consommer, la table a été ouverte par erreur. */
export async function annulerCommandePour(organizationId: string, userId: string, commandeId: string, motif: string): Promise<void> {
  const raison = motif.trim();
  if (raison.length < 3) throw new Error("Indiquez pourquoi la commande est annulée.");

  await db.transaction(async (tx) => {
    const commande = await commandeOuverte(tx, organizationId, commandeId, true);
    const maintenant = new Date();
    await tx
      .update(lignesCommandeSalle)
      .set({ etat: "annulee", motifAnnulation: raison, updatedAt: maintenant, version: sql`${lignesCommandeSalle.version} + 1` })
      .where(and(eq(lignesCommandeSalle.commandeId, commandeId), sql`${lignesCommandeSalle.etat} <> 'annulee'`));
    await tx
      .update(commandesSalle)
      .set({ statut: "annulee", motifAnnulation: raison, closeLe: maintenant, updatedAt: maintenant, version: sql`${commandesSalle.version} + 1` })
      .where(eq(commandesSalle.id, commandeId));
    await tracer(tx, organizationId, userId, "commande_salle.annuler", "commande_salle", commandeId, { numero: commande.numero, motif: raison });
  });
}

// ------------------------------------------------------------- encaissement

export interface EncaissementCommande {
  commandeId: string;
  /** Poste numéroté par le serveur, rattaché au dépôt qui fournit la salle. */
  posteId: string;
  reglements: ReglementAEnregistrer[];
  remisePied?: number;
  clientId?: string | null;
  especesRecues?: number;
}

export interface ResultatEncaissementCommande extends ResultatVente {
  commande: string;
}

/**
 * Encaisse une commande : elle devient une vente, et la vente fait le reste.
 *
 * Tout dans UNE transaction : le numéro du ticket, la vente — avec sa sortie
 * de stock et son écriture —, puis la clôture de la commande. La commande est
 * verrouillée d'entrée : deux serveurs qui encaissent la même table au même
 * instant, le second trouve une commande déjà encaissée et n'encaisse rien.
 *
 * Le numéro du ticket s'attribue par `UPDATE … RETURNING` sur le poste, jamais
 * par une lecture suivie d'une écriture : deux tables encaissées ensemble
 * recevraient sinon le même numéro.
 */
export async function encaisserCommandePour(
  organizationId: string,
  userId: string,
  saisie: EncaissementCommande,
  maintenant = new Date(),
): Promise<ResultatEncaissementCommande> {
  return db.transaction(async (tx) => {
    const commande = await commandeOuverte(tx, organizationId, saisie.commandeId, true);

    const lignes = await tx
      .select()
      .from(lignesCommandeSalle)
      .where(and(eq(lignesCommandeSalle.commandeId, commande.id), sql`${lignesCommandeSalle.etat} <> 'annulee'`))
      .orderBy(lignesCommandeSalle.ordre);
    if (lignes.length === 0) throw new Error("Rien à encaisser : toutes les lignes sont annulées, ou aucune n'a été envoyée.");

    const [poste] = await tx
      .update(postesCaisse)
      .set({ dernierNumero: sql`${postesCaisse.dernierNumero} + 1`, updatedAt: maintenant })
      .where(
        and(
          eq(postesCaisse.id, saisie.posteId),
          eq(postesCaisse.organizationId, organizationId),
          eq(postesCaisse.numerotation, "serveur"),
          eq(postesCaisse.actif, true),
        ),
      )
      .returning({ rang: postesCaisse.dernierNumero });
    if (!poste) throw new Error("Poste d'encaissement de salle introuvable ou fermé.");

    const vente = await enregistrerVenteDans(
      tx,
      organizationId,
      {
        id: newId(),
        caisseId: saisie.posteId,
        numeroSeq: poste.rang,
        clientId: saisie.clientId ?? null,
        encaisseeLe: maintenant,
        remisePied: saisie.remisePied,
        especesRecues: saisie.especesRecues,
        deviceId: null,
        lignes: lignes.map((ligne) => ({
          id: newId(),
          articleId: ligne.articleId,
          designation: ligne.designation,
          quantite: ligne.quantite,
          prixUnitaire: ligne.prixUnitaire,
        })),
        reglements: saisie.reglements,
      },
      userId,
    );

    await tx
      .update(commandesSalle)
      .set({ statut: "encaissee", venteId: vente.id, closeLe: maintenant, updatedAt: maintenant, version: sql`${commandesSalle.version} + 1` })
      .where(eq(commandesSalle.id, commande.id));
    await tracer(tx, organizationId, userId, "commande_salle.encaisser", "commande_salle", commande.id, {
      numero: commande.numero,
      ticket: vente.numero,
      totalTtc: vente.totalTtc,
    });

    return { ...vente, commande: commande.numero };
  });
}

/**
 * Ouvre le poste qui encaisse la salle : numéroté par le serveur, sans
 * appareil, alimenté par le dépôt où la salle prend ses boissons.
 */
export async function creerPosteSallePour(
  organizationId: string,
  userId: string,
  saisie: { code: string; nom: string; depotId: string },
): Promise<{ id: string; code: string }> {
  return db.transaction((tx) =>
    creerPosteCaisseDans(
      tx,
      organizationId,
      { ...saisie, code: saisie.code.trim().toUpperCase(), prefixe: `${saisie.code.trim().toUpperCase()}-`, numerotation: "serveur" },
      userId,
    ),
  );
}
