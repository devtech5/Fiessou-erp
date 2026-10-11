import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, organizations } from "@/db/schema";
import { newId } from "@/lib/ids";
import { prochainNumero, type Transaction } from "@/lib/sequences";
import { enregistrerEcritureDans } from "@/modules/comptabilite/enregistrement";
import { jourLocal } from "@/modules/presences/calcul";
import { ajouterJours, ecritureRestitution, joursEntre } from "@/modules/reservations/calcul";
import { creerRessourceDans, reserverDans, verifierDisponibiliteDans } from "@/modules/reservations/creation";
import { contratsLocation, ressources, type EtatRestitution, type MoyenLocation } from "@/modules/reservations/schema";
import { creerTiersDans } from "@/modules/tiers/creation";
import { tiers } from "@/modules/tiers/schema";

import {
  derniereNuit,
  ecritureAcompte,
  ecritureAnnulation,
  ecritureCaution,
  ecritureDepart,
  periodeContrat,
  prixSejour,
  soldeNote,
  type MoyenSolde,
} from "./calcul";
import {
  acomptesSejour,
  chambresHotel,
  prestationsSejour,
  sejoursHotel,
  voyageursSejour,
  type MenageChambre,
  type NaturePrestation,
} from "./schema";

async function journaliser(
  tx: Transaction,
  organizationId: string,
  userId: string,
  action: string,
  entiteId: string,
  apres: Record<string, unknown>,
) {
  await tx.insert(auditLogs).values({
    id: newId(),
    organizationId,
    userId,
    action,
    entityType: action.split(".")[0],
    entityId: entiteId,
    after: apres,
  });
}

/** Le jour de l'hôtel, dans le fuseau de l'entreprise : une nuit ne bascule pas à minuit UTC. */
export async function aujourdHuiPour(organizationId: string, instant = new Date()): Promise<string> {
  const [org] = await db.select({ fuseau: organizations.timezone }).from(organizations).where(eq(organizations.id, organizationId));
  return jourLocal(instant, org?.fuseau ?? "Africa/Abidjan");
}

async function ecrire(
  tx: Transaction,
  ecriture: Parameters<typeof enregistrerEcritureDans>[1],
  organizationId: string,
  userId: string,
  pieceId: string,
): Promise<string> {
  return enregistrerEcritureDans(tx, ecriture, {
    organizationId,
    userId,
    origine: "saisie",
    pieceId,
    exercice: ecriture.date.slice(0, 4),
    dateIso: ecriture.date,
  });
}

// ----------------------------------------------------------------- chambres

export interface NouvelleChambre {
  numero: string;
  designation?: string | null;
  categorie?: string | null;
  etage?: string | null;
  capacite: number;
  tarifNuit?: number | null;
  tarifSemaine?: number | null;
  tarifMois?: number | null;
  caution?: number;
}

/** Une chambre : une ressource du moteur, et sa fiche d'hôtel. */
export async function creerChambrePour(organizationId: string, donnees: NouvelleChambre, userId: string): Promise<{ id: string; code: string }> {
  const numero = donnees.numero.trim();
  if (!numero) throw new Error("Indiquez le numéro de la chambre.");
  return db.transaction(async (tx) => {
    const [existe] = await tx
      .select({ id: ressources.id })
      .from(ressources)
      .where(and(eq(ressources.organizationId, organizationId), eq(ressources.code, numero)));
    if (existe) throw new Error(`Le numéro ${numero} est déjà pris.`);

    const { id, code } = await creerRessourceDans(
      tx,
      organizationId,
      {
        code: numero,
        designation: donnees.designation?.trim() || `Chambre ${numero}`,
        type: "chambre",
        categorie: donnees.categorie?.trim() || null,
        quantite: 1,
        tarifJour: donnees.tarifNuit ?? null,
        tarifSemaine: donnees.tarifSemaine ?? null,
        tarifMois: donnees.tarifMois ?? null,
        caution: donnees.caution ?? 0,
      },
      userId,
    );
    await tx.insert(chambresHotel).values({
      id: newId(),
      organizationId,
      ressourceId: id,
      etage: donnees.etage?.trim() || null,
      capacite: donnees.capacite,
    });
    return { id, code };
  });
}

async function chambreDe(tx: Transaction, organizationId: string, ressourceId: string) {
  const [chambre] = await tx
    .select({ id: ressources.id, code: ressources.code, type: ressources.type })
    .from(ressources)
    .where(and(eq(ressources.id, ressourceId), eq(ressources.organizationId, organizationId)));
  if (!chambre || chambre.type !== "chambre") throw new Error("Chambre introuvable.");
  return chambre;
}

/** Fiche d'hôtel d'une chambre : créée au premier réglage si la chambre vient de l'écran Réservations. */
async function reglerFicheDans(
  tx: Transaction,
  organizationId: string,
  ressourceId: string,
  reglage: { menage?: MenageChambre; etage?: string | null; capacite?: number },
) {
  const valeurs = {
    ...(reglage.menage ? { menage: reglage.menage, menageLe: new Date() } : {}),
    ...(reglage.etage !== undefined ? { etage: reglage.etage } : {}),
    ...(reglage.capacite !== undefined ? { capacite: reglage.capacite } : {}),
  };
  await tx
    .insert(chambresHotel)
    .values({ id: newId(), organizationId, ressourceId, ...valeurs })
    .onConflictDoUpdate({
      target: chambresHotel.ressourceId,
      set: { ...valeurs, updatedAt: new Date(), version: sql`${chambresHotel.version} + 1` },
    });
}

export async function reglerMenagePour(organizationId: string, userId: string, ressourceId: string, menage: MenageChambre): Promise<string> {
  return db.transaction(async (tx) => {
    const chambre = await chambreDe(tx, organizationId, ressourceId);
    await reglerFicheDans(tx, organizationId, ressourceId, { menage });
    await journaliser(tx, organizationId, userId, "chambre.menage", ressourceId, { code: chambre.code, menage });
    return chambre.code;
  });
}

export async function reglerChambrePour(
  organizationId: string,
  userId: string,
  ressourceId: string,
  reglage: { etage?: string | null; capacite?: number; enService?: boolean },
): Promise<string> {
  return db.transaction(async (tx) => {
    const chambre = await chambreDe(tx, organizationId, ressourceId);
    if (reglage.capacite !== undefined && (!Number.isInteger(reglage.capacite) || reglage.capacite <= 0)) {
      throw new Error("Capacité invalide.");
    }
    await reglerFicheDans(tx, organizationId, ressourceId, { etage: reglage.etage, capacite: reglage.capacite });
    if (reglage.enService !== undefined) {
      await tx
        .update(ressources)
        .set({ statut: reglage.enService ? "active" : "maintenance", updatedAt: new Date(), version: sql`${ressources.version} + 1` })
        .where(eq(ressources.id, ressourceId));
    }
    await journaliser(tx, organizationId, userId, "chambre.regler", ressourceId, { code: chambre.code, ...reglage });
    return chambre.code;
  });
}

// ------------------------------------------------------------------ séjours

export interface NouveauSejour {
  ressourceId: string;
  /** Client existant, ou nouveau client créé avec le séjour. */
  clientId?: string | null;
  nouveauClient?: { nom: string; telephone?: string | null } | null;
  arrivee: string;
  depart: string;
  adultes: number;
  enfants: number;
  /** Tarif négocié à la nuit ; nul, la grille de la chambre. */
  prixNuit?: number | null;
  notes?: string | null;
}

export async function reserverSejourPour(
  organizationId: string,
  donnees: NouveauSejour,
  userId: string,
): Promise<{ id: string; numero: string; montant: number }> {
  const { debut, fin } = periodeContrat(donnees.arrivee, donnees.depart);
  if (donnees.adultes < 1 || donnees.enfants < 0) throw new Error("Nombre de personnes invalide.");

  return db.transaction(async (tx) => {
    const [fiche] = await tx
      .select({ capacite: chambresHotel.capacite })
      .from(chambresHotel)
      .where(and(eq(chambresHotel.ressourceId, donnees.ressourceId), eq(chambresHotel.organizationId, organizationId)));
    const capacite = fiche?.capacite ?? 2;
    const personnes = donnees.adultes + donnees.enfants;
    if (personnes > capacite) throw new Error(`Cette chambre reçoit ${capacite} personne${capacite > 1 ? "s" : ""} au plus.`);
    await chambreDe(tx, organizationId, donnees.ressourceId);

    let clientId = donnees.clientId ?? null;
    if (!clientId) {
      const nom = donnees.nouveauClient?.nom.trim();
      if (!nom) throw new Error("Choisissez un client ou saisissez le nom du nouveau client.");
      ({ id: clientId } = await creerTiersDans(
        tx,
        organizationId,
        { nom, nature: "particulier", estClient: true, telephone: donnees.nouveauClient?.telephone ?? null },
        userId,
      ));
    }

    const contrat = await reserverDans(
      tx,
      organizationId,
      { ressourceId: donnees.ressourceId, clientId, quantite: 1, debut, fin, notes: donnees.notes ?? null, pilote: "hotellerie" },
      userId,
    );

    let montant = contrat.montant;
    if (donnees.prixNuit !== null && donnees.prixNuit !== undefined) {
      const [grille] = await tx.select().from(ressources).where(eq(ressources.id, donnees.ressourceId));
      const prix = prixSejour(grille, donnees.prixNuit, joursEntre(debut, fin));
      if (!prix) throw new Error("Tarif invalide.");
      montant = prix.montant;
      await tx.update(contratsLocation).set({ montant, baseTarif: prix.base }).where(eq(contratsLocation.id, contrat.id));
    }

    const id = newId();
    await tx.insert(sejoursHotel).values({
      id,
      organizationId,
      contratId: contrat.id,
      adultes: donnees.adultes,
      enfants: donnees.enfants,
      prixNuit: donnees.prixNuit ?? null,
    });
    await journaliser(tx, organizationId, userId, "sejour.reserver", id, { numero: contrat.numero, arrivee: donnees.arrivee, depart: donnees.depart, montant });
    return { id, numero: contrat.numero, montant };
  });
}

/**
 * Lit un séjour en le verrouillant : la chambre d'abord (comme le moteur, qui
 * la verrouille pour réserver), puis le contrat et la fiche de séjour.
 */
async function verrouillerSejour(tx: Transaction, organizationId: string, sejourId: string) {
  const [repere] = await tx
    .select({ ressourceId: contratsLocation.ressourceId })
    .from(sejoursHotel)
    .innerJoin(contratsLocation, eq(contratsLocation.id, sejoursHotel.contratId))
    .where(and(eq(sejoursHotel.id, sejourId), eq(sejoursHotel.organizationId, organizationId)));
  if (!repere) throw new Error("Séjour introuvable.");

  const [chambre] = await tx.select().from(ressources).where(eq(ressources.id, repere.ressourceId)).for("update");
  const [ligne] = await tx
    .select({ sejour: sejoursHotel, contrat: contratsLocation, client: tiers.nom, compteClient: tiers.compteClient })
    .from(sejoursHotel)
    .innerJoin(contratsLocation, eq(contratsLocation.id, sejoursHotel.contratId))
    .innerJoin(tiers, eq(tiers.id, contratsLocation.clientId))
    .where(eq(sejoursHotel.id, sejourId))
    .for("update", { of: [sejoursHotel, contratsLocation] });
  return { ...ligne, chambre, debut: String(ligne.contrat.debut), fin: String(ligne.contrat.fin) };
}

/**
 * Change les dates d'un séjour : prolongation, départ avancé, report.
 * Un client déjà arrivé garde son jour d'arrivée.
 */
export async function modifierDatesPour(
  organizationId: string,
  userId: string,
  sejourId: string,
  dates: { arrivee: string; depart: string },
): Promise<{ montant: number }> {
  return db.transaction(async (tx) => {
    const s = await verrouillerSejour(tx, organizationId, sejourId);
    if (s.contrat.statut !== "reserve" && s.contrat.statut !== "en_cours") throw new Error("Ce séjour est clos.");
    if (s.contrat.statut === "en_cours" && dates.arrivee !== s.debut) throw new Error("Le client est arrivé : seul le départ se déplace.");
    const { debut, fin } = periodeContrat(dates.arrivee, dates.depart);

    await verifierDisponibiliteDans(tx, s.chambre, { debut, fin, quantite: 1, sauf: s.contrat.id });
    const prix = prixSejour(s.chambre, s.sejour.prixNuit, joursEntre(debut, fin));
    if (!prix) throw new Error("La grille de cette chambre ne sert pas cette durée.");

    await tx
      .update(contratsLocation)
      .set({ debut, fin, montant: prix.montant, baseTarif: prix.base, updatedAt: new Date(), version: sql`${contratsLocation.version} + 1` })
      .where(eq(contratsLocation.id, s.contrat.id));
    await journaliser(tx, organizationId, userId, "sejour.dates", sejourId, { numero: s.contrat.numero, ...dates, montant: prix.montant });
    return { montant: prix.montant };
  });
}

/**
 * Arrivée du client. Il ne paie rien à ce moment, sauf la caution d'une
 * résidence. La fiche de police doit exister : un voyageur sans pièce
 * d'identité ne monte pas en chambre.
 */
export async function arriveePour(
  organizationId: string,
  userId: string,
  sejourId: string,
  moyenCaution: MoyenLocation | null,
  jour: string,
): Promise<{ ecritureCaution: string | null }> {
  return db.transaction(async (tx) => {
    const s = await verrouillerSejour(tx, organizationId, sejourId);
    if (s.contrat.statut !== "reserve") throw new Error("Ce séjour n'attend pas d'arrivée.");
    if (jour < s.debut) throw new Error("L'arrivée est prévue plus tard : avancez d'abord les dates du séjour.");
    if (jour > s.fin) throw new Error("La date de départ est passée : reportez les dates ou annulez la réservation.");

    const [{ voyageurs }] = await tx
      .select({ voyageurs: sql<number>`count(*)::int` })
      .from(voyageursSejour)
      .where(eq(voyageursSejour.sejourId, sejourId));
    if (Number(voyageurs) === 0) throw new Error("Remplissez d'abord la fiche de police du voyageur.");

    const [fiche] = await tx.select({ menage: chambresHotel.menage }).from(chambresHotel).where(eq(chambresHotel.ressourceId, s.chambre.id));
    if (fiche?.menage === "a_faire") throw new Error(`La chambre ${s.chambre.code} n'est pas faite.`);

    let numeroEcriture: string | null = null;
    if (s.contrat.caution > 0) {
      if (!moyenCaution) throw new Error("Indiquez comment la caution est versée.");
      numeroEcriture = await ecrire(
        tx,
        ecritureCaution({ numero: s.contrat.numero, date: jour, client: s.client, montant: s.contrat.caution, moyen: moyenCaution }),
        organizationId,
        userId,
        s.contrat.id,
      );
    }

    const maintenant = new Date();
    await tx
      .update(contratsLocation)
      .set({ statut: "en_cours", remisLe: maintenant, updatedAt: maintenant, version: sql`${contratsLocation.version} + 1` })
      .where(eq(contratsLocation.id, s.contrat.id));
    await tx
      .update(sejoursHotel)
      .set({
        arriveeLe: maintenant,
        moyenCaution: numeroEcriture ? moyenCaution : null,
        ecritureCaution: numeroEcriture,
        updatedAt: maintenant,
        version: sql`${sejoursHotel.version} + 1`,
      })
      .where(eq(sejoursHotel.id, sejourId));
    await journaliser(tx, organizationId, userId, "sejour.arrivee", sejourId, { numero: s.contrat.numero, chambre: s.chambre.code });
    return { ecritureCaution: numeroEcriture };
  });
}

export interface NouvellePrestation {
  libelle: string;
  nature: NaturePrestation;
  quantite: number;
  prixUnitaire: number;
  tauxTva: number;
}

/** Porte une consommation sur la note de la chambre. */
export async function ajouterPrestationPour(
  organizationId: string,
  userId: string,
  sejourId: string,
  p: NouvellePrestation,
  jour: string,
): Promise<string> {
  if (!Number.isInteger(p.quantite) || p.quantite <= 0) throw new Error("Quantité invalide.");
  if (!Number.isInteger(p.prixUnitaire) || p.prixUnitaire < 0) throw new Error("Prix invalide.");
  return db.transaction(async (tx) => {
    const s = await verrouillerSejour(tx, organizationId, sejourId);
    if (s.contrat.statut !== "en_cours") throw new Error("Seul un client présent consomme sur sa note.");
    const id = newId();
    const montant = p.prixUnitaire * p.quantite;
    await tx.insert(prestationsSejour).values({
      id,
      organizationId,
      sejourId,
      jour,
      libelle: p.libelle.trim(),
      nature: p.nature,
      quantite: p.quantite,
      prixUnitaire: p.prixUnitaire,
      montant,
      tauxTva: p.tauxTva,
      userId,
    });
    await journaliser(tx, organizationId, userId, "sejour.prestation", sejourId, { numero: s.contrat.numero, libelle: p.libelle, montant });
    return id;
  });
}

/** Retire une ligne saisie par erreur, tant que la note n'est pas soldée. La ligne reste en base, effacée. */
export async function retirerPrestationPour(organizationId: string, userId: string, prestationId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [p] = await tx
      .select({ sejourId: prestationsSejour.sejourId, libelle: prestationsSejour.libelle, montant: prestationsSejour.montant })
      .from(prestationsSejour)
      .where(and(eq(prestationsSejour.id, prestationId), eq(prestationsSejour.organizationId, organizationId), isNull(prestationsSejour.deletedAt)));
    if (!p) throw new Error("Ligne introuvable.");
    const s = await verrouillerSejour(tx, organizationId, p.sejourId);
    if (s.contrat.statut !== "en_cours") throw new Error("La note est soldée : elle ne se modifie plus.");
    await tx.update(prestationsSejour).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(prestationsSejour.id, prestationId));
    await journaliser(tx, organizationId, userId, "sejour.prestation_retirer", p.sejourId, { numero: s.contrat.numero, libelle: p.libelle, montant: p.montant });
  });
}

/** Acompte, avant ou pendant le séjour. Numéroté, écrit en 4191. */
export async function verserAcomptePour(
  organizationId: string,
  userId: string,
  sejourId: string,
  versement: { montant: number; moyen: MoyenLocation },
  jour: string,
): Promise<{ numero: string; ecriture: string }> {
  if (!Number.isInteger(versement.montant) || versement.montant <= 0) throw new Error("Montant invalide.");
  return db.transaction(async (tx) => {
    const s = await verrouillerSejour(tx, organizationId, sejourId);
    if (s.contrat.statut !== "reserve" && s.contrat.statut !== "en_cours") throw new Error("Ce séjour est clos.");
    const annee = jour.slice(0, 4);
    const numero = await prochainNumero(tx, organizationId, { cle: "acompte:sejour", prefix: `ACP-${annee}-`, padding: 5, periode: annee });
    const id = newId();
    const ecriture = await ecrire(
      tx,
      ecritureAcompte({ numero, date: jour, client: s.client, montant: versement.montant, moyen: versement.moyen }),
      organizationId,
      userId,
      id,
    );
    await tx.insert(acomptesSejour).values({ id, organizationId, sejourId, numero, jour, montant: versement.montant, moyen: versement.moyen, ecriture, userId });
    await journaliser(tx, organizationId, userId, "sejour.acompte", sejourId, { numero: s.contrat.numero, acompte: numero, montant: versement.montant });
    return { numero, ecriture };
  });
}

export interface FicheVoyageur {
  nom: string;
  prenoms?: string | null;
  dateNaissance?: string | null;
  lieuNaissance?: string | null;
  nationalite: string;
  profession?: string | null;
  domicile?: string | null;
  telephone?: string | null;
  pieceNature: string;
  pieceNumero: string;
  pieceDelivreeLe?: string | null;
  provenance?: string | null;
  destination?: string | null;
}

export async function ajouterVoyageurPour(organizationId: string, userId: string, sejourId: string, fiche: FicheVoyageur): Promise<string> {
  return db.transaction(async (tx) => {
    const s = await verrouillerSejour(tx, organizationId, sejourId);
    if (s.contrat.statut !== "reserve" && s.contrat.statut !== "en_cours") throw new Error("Ce séjour est clos.");
    const id = newId();
    await tx.insert(voyageursSejour).values({ id, organizationId, sejourId, ...fiche, userId });
    await journaliser(tx, organizationId, userId, "sejour.voyageur", sejourId, { numero: s.contrat.numero, nom: fiche.nom });
    return id;
  });
}

/**
 * Départ : la note se solde en une écriture, la caution se rend, la chambre
 * passe au ménage.
 *
 * Les nuits se recomptent sur le départ réel. Un client qui part plus tôt ne
 * paie pas les nuits qu'il n'a pas passées ; un client qui reste plus tard paie
 * les siennes, à condition que la chambre ne soit pas promise à un autre.
 */
export async function departPour(
  organizationId: string,
  userId: string,
  sejourId: string,
  reglement: { moyen: MoyenSolde | null; etat?: EtatRestitution; retenue?: number },
  jour: string,
): Promise<{ total: number; reste: number; ecriture: string | null }> {
  return db.transaction(async (tx) => {
    const s = await verrouillerSejour(tx, organizationId, sejourId);
    if (s.contrat.statut !== "en_cours") throw new Error("Seul un client présent peut partir.");

    let { montant, baseTarif } = s.contrat;
    const fin = derniereNuit(s.debut, jour);
    if (fin !== s.fin) {
      if (fin > s.fin) {
        await verifierDisponibiliteDans(tx, s.chambre, { debut: ajouterJours(s.fin, 1), fin, quantite: 1, sauf: s.contrat.id });
      }
      const prix = prixSejour(s.chambre, s.sejour.prixNuit, joursEntre(s.debut, fin));
      if (!prix) throw new Error("La grille de cette chambre ne sert pas cette durée.");
      ({ montant, base: baseTarif } = prix);
    }

    const prestations = await tx
      .select({ montant: prestationsSejour.montant, tauxTva: prestationsSejour.tauxTva, nature: prestationsSejour.nature })
      .from(prestationsSejour)
      .where(and(eq(prestationsSejour.sejourId, sejourId), isNull(prestationsSejour.deletedAt)));
    const acomptes = await tx.select({ montant: acomptesSejour.montant }).from(acomptesSejour).where(eq(acomptesSejour.sejourId, sejourId));
    const note = soldeNote(montant, prestations, acomptes);

    let numeroEcriture: string | null = null;
    if (note.total > 0 || note.verse > 0) {
      numeroEcriture = await ecrire(
        tx,
        ecritureDepart({
          numero: s.contrat.numero,
          date: jour,
          client: s.client,
          compteAuxiliaire: s.compteClient,
          lignes: [
            { montant, tauxTvaBp: s.chambre.tauxTva, nature: "service" },
            ...prestations.map((p) => ({ montant: p.montant, tauxTvaBp: p.tauxTva, nature: p.nature })),
          ],
          acomptes: note.verse,
          moyen: reglement.moyen,
        }),
        organizationId,
        userId,
        s.contrat.id,
      );
    }

    // La caution se rend par le moyen qui l'a reçue.
    const retenue = reglement.retenue ?? 0;
    if (!Number.isInteger(retenue) || retenue < 0 || retenue > s.contrat.caution) throw new Error("La retenue ne peut dépasser la caution.");
    let ecritureRendu: string | null = null;
    if (s.sejour.ecritureCaution && s.sejour.moyenCaution) {
      const restitution = ecritureRestitution({
        numero: s.contrat.numero,
        date: jour,
        client: s.client,
        caution: s.contrat.caution,
        retenue,
        moyen: s.sejour.moyenCaution,
      });
      if (restitution) ecritureRendu = await ecrire(tx, restitution, organizationId, userId, s.contrat.id);
    }

    const maintenant = new Date();
    await tx
      .update(contratsLocation)
      .set({
        fin,
        montant,
        baseTarif,
        statut: "restitue",
        restitueLe: maintenant,
        etatRestitution: reglement.etat ?? "bon",
        retenue: ecritureRendu ? retenue : 0,
        ecritureRestitution: ecritureRendu,
        updatedAt: maintenant,
        version: sql`${contratsLocation.version} + 1`,
      })
      .where(eq(contratsLocation.id, s.contrat.id));
    await tx
      .update(sejoursHotel)
      .set({ departLe: maintenant, totalNote: note.total, ecritureDepart: numeroEcriture, updatedAt: maintenant, version: sql`${sejoursHotel.version} + 1` })
      .where(eq(sejoursHotel.id, sejourId));
    await reglerFicheDans(tx, organizationId, s.chambre.id, { menage: "a_faire" });
    await journaliser(tx, organizationId, userId, "sejour.depart", sejourId, { numero: s.contrat.numero, total: note.total, reste: note.reste });
    return { total: note.total, reste: note.reste, ecriture: numeroEcriture };
  });
}

/**
 * Annule une réservation avant l'arrivée. Les acomptes reçus se rendent ou se
 * gardent en dédit ; dans les deux cas, ils quittent le 4191.
 */
export async function annulerSejourPour(
  organizationId: string,
  userId: string,
  sejourId: string,
  motif: string,
  sort: { rendre: MoyenLocation } | "conserver" | null,
  jour: string,
): Promise<{ ecriture: string | null }> {
  if (motif.trim().length < 3) throw new Error("Indiquez le motif de l'annulation.");
  return db.transaction(async (tx) => {
    const s = await verrouillerSejour(tx, organizationId, sejourId);
    if (s.contrat.statut !== "reserve") throw new Error("Seule une réservation pas encore arrivée s'annule.");

    const acomptes = await tx.select({ montant: acomptesSejour.montant }).from(acomptesSejour).where(eq(acomptesSejour.sejourId, sejourId));
    const verse = acomptes.reduce((somme, a) => somme + a.montant, 0);
    let numeroEcriture: string | null = null;
    if (verse > 0) {
      if (!sort) throw new Error("Un acompte a été versé : dites s'il est rendu ou conservé.");
      numeroEcriture = await ecrire(
        tx,
        ecritureAnnulation({ numero: s.contrat.numero, date: jour, client: s.client, acomptes: verse, sort }),
        organizationId,
        userId,
        s.contrat.id,
      );
    }

    await tx
      .update(contratsLocation)
      .set({ statut: "annule", motif: motif.trim(), updatedAt: new Date(), version: sql`${contratsLocation.version} + 1` })
      .where(eq(contratsLocation.id, s.contrat.id));
    await journaliser(tx, organizationId, userId, "sejour.annuler", sejourId, { numero: s.contrat.numero, motif, acomptes: verse });
    return { ecriture: numeroEcriture };
  });
}
