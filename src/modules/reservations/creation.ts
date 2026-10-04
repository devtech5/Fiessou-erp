import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { auditLogs } from "@/db/schema";
import { ecritureVenteComptoir } from "@/lib/comptabilite/ecritures";
import { newId } from "@/lib/ids";
import { prochainNumero, type Transaction } from "@/lib/sequences";
import { enregistrerEcritureDans } from "@/modules/comptabilite/enregistrement";
import { tiers } from "@/modules/tiers/schema";

import {
  accesAbonnement,
  ecritureRemise,
  ecritureRestitution,
  joursEntre,
  occupationMax,
  prixPeriode,
} from "./calcul";
import {
  abonnements,
  contratsLocation,
  passagesAbonnement,
  ressources,
  type EtatRestitution,
  type MoyenLocation,
  type TypeRessource,
} from "./schema";

const PREFIXE_RESSOURCE: Record<TypeRessource, string> = {
  equipement: "EQP-",
  chambre: "CHB-",
  salle: "SAL-",
  creneau: "CRN-",
};

async function journaliser(
  tx: Transaction,
  organizationId: string,
  userId: string | undefined,
  action: string,
  entiteId: string,
  apres: Record<string, unknown>,
) {
  if (!userId) return;
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

// --------------------------------------------------------------- ressources

export interface NouvelleRessource {
  designation: string;
  type: TypeRessource;
  categorie?: string | null;
  quantite: number;
  tarifJour?: number | null;
  tarifSemaine?: number | null;
  tarifMois?: number | null;
  caution?: number;
  code?: string | null;
}

export async function creerRessourceDans(
  tx: Transaction,
  organizationId: string,
  donnees: NouvelleRessource,
  userId?: string,
): Promise<{ id: string; code: string }> {
  if (!donnees.tarifJour && !donnees.tarifSemaine && !donnees.tarifMois) {
    throw new Error("Indiquez au moins un tarif : jour, semaine ou mois.");
  }
  const code =
    donnees.code?.trim() ||
    (await prochainNumero(tx, organizationId, {
      cle: `ressource:${donnees.type}`,
      prefix: PREFIXE_RESSOURCE[donnees.type],
      padding: 3,
    }));

  const id = newId();
  await tx.insert(ressources).values({
    id,
    organizationId,
    code,
    designation: donnees.designation.trim(),
    type: donnees.type,
    categorie: donnees.categorie ?? null,
    quantite: donnees.quantite,
    tarifJour: donnees.tarifJour ?? null,
    tarifSemaine: donnees.tarifSemaine ?? null,
    tarifMois: donnees.tarifMois ?? null,
    caution: donnees.caution ?? 0,
  });

  await journaliser(tx, organizationId, userId, "ressource.creer", id, { code, designation: donnees.designation });
  return { id, code };
}

// ----------------------------------------------------------------- contrats

export interface NouveauContrat {
  ressourceId: string;
  clientId: string;
  quantite: number;
  debut: string;
  fin: string;
  notes?: string | null;
}

/**
 * Réserve une ressource.
 *
 * La ressource est verrouillée le temps de la transaction : deux comptoirs qui
 * réservent le dernier exemplaire au même instant passent l'un après l'autre,
 * et le second est refusé. Sans ce verrou, les deux liraient « 1 disponible »
 * et le même groupe électrogène partirait chez deux clients.
 */
export async function reserverDans(
  tx: Transaction,
  organizationId: string,
  donnees: NouveauContrat,
  userId?: string,
): Promise<{ id: string; numero: string; montant: number }> {
  if (donnees.fin < donnees.debut) throw new Error("La fin précède le début.");
  if (donnees.quantite <= 0) throw new Error("Quantité invalide.");

  const [ressource] = await tx
    .select()
    .from(ressources)
    .where(and(eq(ressources.id, donnees.ressourceId), eq(ressources.organizationId, organizationId)))
    .for("update");
  if (!ressource) throw new Error("Ressource introuvable.");
  if (ressource.statut !== "active") {
    throw new Error(`« ${ressource.designation} » n'est pas louable (${ressource.statut}).`);
  }

  const [client] = await tx
    .select({ id: tiers.id, nom: tiers.nom })
    .from(tiers)
    .where(and(eq(tiers.id, donnees.clientId), eq(tiers.organizationId, organizationId)));
  if (!client) throw new Error("Client introuvable.");

  const engages = await tx
    .select({ debut: contratsLocation.debut, fin: contratsLocation.fin, quantite: contratsLocation.quantite })
    .from(contratsLocation)
    .where(
      and(
        eq(contratsLocation.ressourceId, ressource.id),
        inArray(contratsLocation.statut, ["reserve", "en_cours"]),
        sql`${contratsLocation.debut} <= ${donnees.fin} and ${contratsLocation.fin} >= ${donnees.debut}`,
      ),
    );

  const pris = occupationMax(
    engages.map((e) => ({ debut: String(e.debut), fin: String(e.fin), quantite: e.quantite })),
    donnees.debut,
    donnees.fin,
  );
  const libres = ressource.quantite - pris;
  if (donnees.quantite > libres) {
    throw new Error(
      libres <= 0
        ? `« ${ressource.designation} » est complet sur cette période.`
        : `Il ne reste que ${libres} exemplaire${libres > 1 ? "s" : ""} sur cette période.`,
    );
  }

  const jours = joursEntre(donnees.debut, donnees.fin);
  const prix = prixPeriode(ressource, jours);
  if (!prix) throw new Error("La grille de cette ressource ne sert pas cette durée.");

  const annee = donnees.debut.slice(0, 4);
  const numero = await prochainNumero(tx, organizationId, {
    cle: ressource.type === "chambre" ? "contrat:sejour" : "contrat:location",
    prefix: `${ressource.type === "chambre" ? "SEJ" : "LOC"}-${annee}-`,
    padding: 5,
    periode: annee,
  });

  const id = newId();
  const montant = prix.montant * donnees.quantite;
  await tx.insert(contratsLocation).values({
    id,
    organizationId,
    numero,
    ressourceId: ressource.id,
    clientId: client.id,
    quantite: donnees.quantite,
    debut: donnees.debut,
    fin: donnees.fin,
    baseTarif: prix.base,
    montant,
    caution: ressource.caution * donnees.quantite,
    notes: donnees.notes ?? null,
    userId: userId ?? null,
  });

  await journaliser(tx, organizationId, userId, "contrat.reserver", id, { numero, montant });
  return { id, numero, montant };
}

async function lireContrat(tx: Transaction, organizationId: string, id: string) {
  const [ligne] = await tx
    .select({
      contrat: contratsLocation,
      client: tiers.nom,
      tauxTva: ressources.tauxTva,
    })
    .from(contratsLocation)
    .innerJoin(tiers, eq(tiers.id, contratsLocation.clientId))
    .innerJoin(ressources, eq(ressources.id, contratsLocation.ressourceId))
    .where(and(eq(contratsLocation.id, id), eq(contratsLocation.organizationId, organizationId)))
    .for("update", { of: contratsLocation });
  if (!ligne) throw new Error("Contrat introuvable.");
  return ligne;
}

/**
 * Remet le bien au client : il paie la location et dépose la caution, et
 * l'écriture se passe dans la même transaction.
 */
export async function remettreDans(
  tx: Transaction,
  organizationId: string,
  contratId: string,
  moyen: MoyenLocation,
  userId: string,
): Promise<{ ecriture: string }> {
  const { contrat, client, tauxTva } = await lireContrat(tx, organizationId, contratId);
  if (contrat.statut !== "reserve") throw new Error("Seule une réservation se remet au client.");

  const aujourdHui = new Date().toISOString().slice(0, 10);
  const ecriture = ecritureRemise({
    numero: contrat.numero,
    date: aujourdHui,
    client,
    montantTtc: contrat.montant,
    tauxTvaBp: tauxTva,
    caution: contrat.caution,
    moyen,
  });
  const numeroEcriture = await enregistrerEcritureDans(tx, ecriture, {
    organizationId,
    userId,
    origine: "saisie",
    pieceId: contrat.id,
    exercice: aujourdHui.slice(0, 4),
    dateIso: aujourdHui,
  });

  await tx
    .update(contratsLocation)
    .set({
      statut: "en_cours",
      remisLe: new Date(),
      moyenEncaissement: moyen,
      ecritureRemise: numeroEcriture,
      updatedAt: new Date(),
      version: sql`${contratsLocation.version} + 1`,
    })
    .where(eq(contratsLocation.id, contrat.id));

  await journaliser(tx, organizationId, userId, "contrat.remettre", contrat.id, { numero: contrat.numero, ecriture: numeroEcriture });
  return { ecriture: numeroEcriture };
}

/**
 * Restitution : constat de l'état, caution rendue moins la retenue.
 *
 * La caution est rendue par le même moyen qu'elle a été reçue : la rendre en
 * espèces après l'avoir reçue par virement ferait sortir du tiroir un argent
 * qui n'y est jamais entré.
 */
export async function restituerDans(
  tx: Transaction,
  organizationId: string,
  contratId: string,
  constat: { etat: EtatRestitution; retenue: number },
  userId: string,
): Promise<{ ecriture: string | null }> {
  const { contrat, client } = await lireContrat(tx, organizationId, contratId);
  if (contrat.statut !== "en_cours") throw new Error("Seul un contrat en cours se restitue.");
  if (constat.retenue > contrat.caution) throw new Error("La retenue ne peut dépasser la caution.");

  const aujourdHui = new Date().toISOString().slice(0, 10);
  const ecriture = ecritureRestitution({
    numero: contrat.numero,
    date: aujourdHui,
    client,
    caution: contrat.caution,
    retenue: constat.retenue,
    moyen: contrat.moyenEncaissement ?? "especes",
  });

  const numeroEcriture = ecriture
    ? await enregistrerEcritureDans(tx, ecriture, {
        organizationId,
        userId,
        origine: "saisie",
        pieceId: contrat.id,
        exercice: aujourdHui.slice(0, 4),
        dateIso: aujourdHui,
      })
    : null;

  await tx
    .update(contratsLocation)
    .set({
      statut: "restitue",
      restitueLe: new Date(),
      etatRestitution: constat.etat,
      retenue: constat.retenue,
      ecritureRestitution: numeroEcriture,
      updatedAt: new Date(),
      version: sql`${contratsLocation.version} + 1`,
    })
    .where(eq(contratsLocation.id, contrat.id));

  await journaliser(tx, organizationId, userId, "contrat.restituer", contrat.id, {
    numero: contrat.numero,
    etat: constat.etat,
    retenue: constat.retenue,
  });
  return { ecriture: numeroEcriture };
}

/** Annule une réservation pas encore remise. Rien n'a été encaissé : rien à contrepasser. */
export async function annulerContratDans(
  tx: Transaction,
  organizationId: string,
  contratId: string,
  motif: string,
  userId: string,
): Promise<boolean> {
  const [annule] = await tx
    .update(contratsLocation)
    .set({ statut: "annule", motif, updatedAt: new Date(), version: sql`${contratsLocation.version} + 1` })
    .where(
      and(
        eq(contratsLocation.id, contratId),
        eq(contratsLocation.organizationId, organizationId),
        eq(contratsLocation.statut, "reserve"),
      ),
    )
    .returning({ numero: contratsLocation.numero });
  if (annule) await journaliser(tx, organizationId, userId, "contrat.annuler", contratId, { numero: annule.numero, motif });
  return Boolean(annule);
}

// -------------------------------------------------------------- abonnements

export interface NouvelAbonnement {
  nom: string;
  telephone?: string | null;
  formule: string;
  debut: string;
  fin: string;
  montant: number;
  seancesIncluses?: number | null;
  moyen: MoyenLocation;
}

/** Inscrit un adhérent et encaisse sa formule, écriture comprise. */
export async function inscrireAdherentDans(
  tx: Transaction,
  organizationId: string,
  donnees: NouvelAbonnement,
  userId?: string,
): Promise<{ id: string; code: string }> {
  if (donnees.fin < donnees.debut) throw new Error("La fin précède le début.");

  const code = await prochainNumero(tx, organizationId, { cle: "adherent", prefix: "AB-", padding: 4 });
  const id = newId();

  let numeroEcriture: string | null = null;
  if (donnees.montant > 0 && userId) {
    const ecriture = ecritureVenteComptoir({
      numero: code,
      date: donnees.debut,
      client: donnees.nom,
      lignes: [{ montantTTC: donnees.montant, tauxTvaBp: 1800, compte: "706", libelleCompte: "Services vendus" }],
      reglements: [{ moyen: donnees.moyen, montant: donnees.montant }],
    });
    numeroEcriture = await enregistrerEcritureDans(tx, ecriture, {
      organizationId,
      userId,
      origine: "saisie",
      pieceId: id,
      exercice: donnees.debut.slice(0, 4),
      dateIso: donnees.debut,
    });
  }

  await tx.insert(abonnements).values({
    id,
    organizationId,
    code,
    nom: donnees.nom.trim(),
    telephone: donnees.telephone ?? null,
    formule: donnees.formule.trim(),
    debut: donnees.debut,
    fin: donnees.fin,
    montant: donnees.montant,
    seancesIncluses: donnees.seancesIncluses ?? null,
    moyenEncaissement: donnees.moyen,
    ecriture: numeroEcriture,
    userId: userId ?? null,
  });

  await journaliser(tx, organizationId, userId, "abonnement.inscrire", id, { code, formule: donnees.formule });
  return { id, code };
}

/**
 * Enregistre une venue. Le contrôle se fait ici, abonnement verrouillé : deux
 * passages simultanés sur la dernière séance n'en consomment pas deux.
 */
export async function enregistrerPassageDans(
  tx: Transaction,
  organizationId: string,
  abonnementId: string,
  userId: string,
  aujourdHui = new Date().toISOString().slice(0, 10),
): Promise<{ restantes: number | null }> {
  const [abonnement] = await tx
    .select()
    .from(abonnements)
    .where(and(eq(abonnements.id, abonnementId), eq(abonnements.organizationId, organizationId)))
    .for("update");
  if (!abonnement) throw new Error("Adhérent introuvable.");

  const [{ nombre }] = await tx
    .select({ nombre: sql<string>`count(*)` })
    .from(passagesAbonnement)
    .where(eq(passagesAbonnement.abonnementId, abonnement.id));

  const acces = accesAbonnement(
    {
      debut: String(abonnement.debut),
      fin: String(abonnement.fin),
      seancesIncluses: abonnement.seancesIncluses,
      seancesConsommees: Number(nombre),
    },
    aujourdHui,
  );
  if (!acces.ok) throw new Error(acces.raison);

  await tx.insert(passagesAbonnement).values({
    id: newId(),
    organizationId,
    abonnementId: abonnement.id,
    userId,
  });
  return { restantes: acces.restantes };
}
