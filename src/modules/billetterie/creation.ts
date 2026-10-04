import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { auditLogs } from "@/db/schema";
import { contrepasser } from "@/lib/comptabilite/ecritures";
import { newId } from "@/lib/ids";
import { prochainNumero, type Transaction } from "@/lib/sequences";
import { enregistrerEcritureDans } from "@/modules/comptabilite/enregistrement";

import { departVendable, ecritureBillet, siegeValide, transitionPermise } from "./calcul";
import {
  billets,
  departs,
  lignesTransport,
  type CanalBillet,
  type MoyenBillet,
  type StatutDepart,
} from "./schema";

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

const jourIso = (date: Date) => date.toISOString().slice(0, 10);

// ------------------------------------------------------------------- lignes

export interface NouvelleLigne {
  code: string;
  depart: string;
  arrivee: string;
  dureeMinutes: number;
  distanceKm?: number | null;
  tarif: number;
  tauxTva?: number;
}

export async function creerLigneDans(
  tx: Transaction,
  organizationId: string,
  donnees: NouvelleLigne,
  userId?: string,
): Promise<{ id: string; code: string }> {
  const id = newId();
  const code = donnees.code.trim().toUpperCase();
  await tx.insert(lignesTransport).values({
    id,
    organizationId,
    code,
    depart: donnees.depart.trim(),
    arrivee: donnees.arrivee.trim(),
    dureeMinutes: donnees.dureeMinutes,
    distanceKm: donnees.distanceKm ?? null,
    tarif: donnees.tarif,
    tauxTva: donnees.tauxTva ?? 1800,
  });
  await journaliser(tx, organizationId, userId, "ligne.creer", id, { code, tarif: donnees.tarif });
  return { id, code };
}

// ------------------------------------------------------------------ départs

export interface NouveauDepart {
  ligneId: string;
  partLe: Date;
  vehicule: string;
  rangees: number;
}

/** Programme un départ. Le tarif de la ligne est recopié : il ne bougera plus. */
export async function programmerDepartDans(
  tx: Transaction,
  organizationId: string,
  donnees: NouveauDepart,
  userId?: string,
): Promise<{ id: string; reference: string }> {
  const [ligne] = await tx
    .select()
    .from(lignesTransport)
    .where(and(eq(lignesTransport.id, donnees.ligneId), eq(lignesTransport.organizationId, organizationId)));
  if (!ligne) throw new Error("Ligne introuvable.");
  if (!ligne.active) throw new Error(`La ligne ${ligne.code} n'est plus desservie.`);

  const annee = jourIso(donnees.partLe).slice(0, 4);
  const reference = await prochainNumero(tx, organizationId, {
    cle: "depart",
    prefix: `DEP-${annee}-`,
    padding: 5,
    periode: annee,
  });

  const id = newId();
  await tx.insert(departs).values({
    id,
    organizationId,
    reference,
    ligneId: ligne.id,
    partLe: donnees.partLe,
    vehicule: donnees.vehicule.trim(),
    rangees: donnees.rangees,
    tarif: ligne.tarif,
    tauxTva: ligne.tauxTva,
  });
  await journaliser(tx, organizationId, userId, "depart.programmer", id, { reference, ligne: ligne.code });
  return { id, reference };
}

async function lireDepart(tx: Transaction, organizationId: string, departId: string) {
  const [ligne] = await tx
    .select({ depart: departs, ligne: lignesTransport })
    .from(departs)
    .innerJoin(lignesTransport, eq(lignesTransport.id, departs.ligneId))
    .where(and(eq(departs.id, departId), eq(departs.organizationId, organizationId)))
    .for("update", { of: departs });
  if (!ligne) throw new Error("Départ introuvable.");
  return ligne;
}

// ------------------------------------------------------------------ billets

export interface NouvelleVente {
  departId: string;
  sieges: string[];
  /** Un passager par siège, dans le même ordre. */
  passagers: { nom: string; telephone?: string | null; piece?: string | null }[];
  moyen: MoyenBillet;
  canal?: CanalBillet;
  /** Date comptable ; par défaut, aujourd'hui. */
  date?: string;
}

/**
 * Émet les billets d'une vente.
 *
 * Le départ est verrouillé le temps de la transaction : deux guichets qui
 * vendent le même siège passent l'un après l'autre et le second est refusé
 * avec le numéro du siège. L'index unique partiel reste derrière, au cas où
 * un chemin oublierait le verrou.
 */
export async function vendreBilletsDans(
  tx: Transaction,
  organizationId: string,
  vente: NouvelleVente,
  userId?: string,
): Promise<{ numeros: string[]; total: number }> {
  if (vente.sieges.length === 0) throw new Error("Choisissez au moins un siège.");
  if (vente.sieges.length !== vente.passagers.length) throw new Error("Un passager par siège.");
  if (new Set(vente.sieges).size !== vente.sieges.length) throw new Error("Le même siège figure deux fois.");

  const { depart, ligne } = await lireDepart(tx, organizationId, vente.departId);
  if (!departVendable(depart.statut)) {
    throw new Error(depart.statut === "parti" ? "Ce car est parti." : "Ce départ est annulé.");
  }

  const horsPlan = vente.sieges.filter((s) => !siegeValide(s, depart.rangees));
  if (horsPlan.length > 0) throw new Error(`Siège inexistant dans ce véhicule : ${horsPlan.join(", ")}.`);

  const pris = await tx
    .select({ siege: billets.siege })
    .from(billets)
    .where(and(eq(billets.departId, depart.id), ne(billets.statut, "annule"), inArray(billets.siege, vente.sieges)));
  if (pris.length > 0) {
    const liste = pris.map((p) => p.siege).join(", ");
    throw new Error(pris.length > 1 ? `Sièges déjà vendus : ${liste}.` : `Le siège ${liste} vient d'être vendu.`);
  }

  const date = vente.date ?? jourIso(new Date());
  const annee = date.slice(0, 4);
  const trajet = `${ligne.depart} → ${ligne.arrivee}`;
  const numeros: string[] = [];

  for (const [index, siege] of vente.sieges.entries()) {
    const passager = vente.passagers[index];
    if (!passager.nom.trim()) throw new Error(`Nom du passager manquant pour le siège ${siege}.`);

    const numero = await prochainNumero(tx, organizationId, {
      cle: "billet",
      prefix: `BIL-${annee}-`,
      padding: 6,
      periode: annee,
    });
    const id = newId();

    let numeroEcriture: string | null = null;
    if (depart.tarif > 0 && userId) {
      numeroEcriture = await enregistrerEcritureDans(
        tx,
        ecritureBillet({
          numero,
          date,
          passager: passager.nom.trim(),
          trajet,
          montant: depart.tarif,
          tauxTvaBp: depart.tauxTva,
          moyen: vente.moyen,
        }),
        { organizationId, userId, origine: "saisie", pieceId: id, exercice: annee, dateIso: date },
      );
    }

    await tx.insert(billets).values({
      id,
      organizationId,
      numero,
      departId: depart.id,
      siege,
      passager: passager.nom.trim(),
      telephone: passager.telephone?.trim() || null,
      piece: passager.piece?.trim() || null,
      montant: depart.tarif,
      canal: vente.canal ?? "guichet",
      moyen: vente.moyen,
      ecriture: numeroEcriture,
      userId: userId ?? null,
    });
    numeros.push(numero);
  }

  await journaliser(tx, organizationId, userId, "billet.vendre", depart.id, {
    depart: depart.reference,
    sieges: vente.sieges,
    numeros,
  });
  return { numeros, total: depart.tarif * vente.sieges.length };
}

/**
 * Contrôle à la montée : le billet valide passe « embarqué ». Un billet déjà
 * embarqué est refusé — c'est le signe d'une photocopie.
 */
export async function embarquerDans(
  tx: Transaction,
  organizationId: string,
  billetId: string,
  userId: string,
): Promise<{ numero: string; siege: string }> {
  const [billet] = await tx
    .select({ billet: billets, statutDepart: departs.statut })
    .from(billets)
    .innerJoin(departs, eq(departs.id, billets.departId))
    .where(and(eq(billets.id, billetId), eq(billets.organizationId, organizationId)))
    .for("update", { of: billets });
  if (!billet) throw new Error("Billet introuvable.");
  if (billet.billet.statut === "embarque") throw new Error(`Billet ${billet.billet.numero} déjà contrôlé à bord.`);
  if (billet.billet.statut !== "valide") throw new Error(`Billet ${billet.billet.numero} non valable.`);
  if (billet.statutDepart !== "embarquement") throw new Error("L'embarquement de ce départ n'est pas ouvert.");

  await tx
    .update(billets)
    .set({ statut: "embarque", embarqueLe: new Date(), updatedAt: new Date(), version: sql`${billets.version} + 1` })
    .where(eq(billets.id, billet.billet.id));
  await journaliser(tx, organizationId, userId, "billet.embarquer", billet.billet.id, { numero: billet.billet.numero });
  return { numero: billet.billet.numero, siege: billet.billet.siege };
}

/**
 * Annule un billet avant le départ : le siège se libère et la recette se
 * contrepasse. Le passager est remboursé par le moyen qui l'a payé.
 */
export async function annulerBilletDans(
  tx: Transaction,
  organizationId: string,
  billetId: string,
  motif: string,
  userId: string,
): Promise<{ numero: string; ecriture: string | null }> {
  const [ligne] = await tx
    .select({ billet: billets, depart: departs, ligne: lignesTransport })
    .from(billets)
    .innerJoin(departs, eq(departs.id, billets.departId))
    .innerJoin(lignesTransport, eq(lignesTransport.id, departs.ligneId))
    .where(and(eq(billets.id, billetId), eq(billets.organizationId, organizationId)))
    .for("update", { of: billets });
  if (!ligne) throw new Error("Billet introuvable.");
  return annulerUnBillet(tx, organizationId, ligne, motif, userId);
}

async function annulerUnBillet(
  tx: Transaction,
  organizationId: string,
  { billet, depart, ligne }: { billet: typeof billets.$inferSelect; depart: typeof departs.$inferSelect; ligne: typeof lignesTransport.$inferSelect },
  motif: string,
  userId: string,
  departAnnule = false,
): Promise<{ numero: string; ecriture: string | null }> {
  // Un départ annulé rembourse aussi ceux qui étaient déjà montés à bord.
  const annulable = billet.statut === "valide" || (departAnnule && billet.statut === "embarque");
  if (!annulable) {
    throw new Error(
      billet.statut === "embarque"
        ? `Le passager du billet ${billet.numero} est déjà à bord.`
        : `Le billet ${billet.numero} n'est plus annulable.`,
    );
  }
  if (depart.statut === "parti") throw new Error("Le car est parti : le billet n'est plus remboursable.");

  const aujourdHui = jourIso(new Date());
  let numeroEcriture: string | null = null;
  if (billet.ecriture && billet.montant > 0) {
    const origine = ecritureBillet({
      numero: billet.numero,
      date: aujourdHui,
      passager: billet.passager,
      trajet: `${ligne.depart} → ${ligne.arrivee}`,
      montant: billet.montant,
      tauxTvaBp: depart.tauxTva,
      moyen: billet.moyen,
    });
    numeroEcriture = await enregistrerEcritureDans(
      tx,
      contrepasser(origine, `${billet.numero}-A`, `Annulation billet ${billet.numero} — ${motif}`, aujourdHui),
      { organizationId, userId, origine: "avoir", pieceId: billet.id, exercice: aujourdHui.slice(0, 4), dateIso: aujourdHui },
    );
  }

  await tx
    .update(billets)
    .set({
      statut: "annule",
      motif,
      ecritureAnnulation: numeroEcriture,
      updatedAt: new Date(),
      version: sql`${billets.version} + 1`,
    })
    .where(eq(billets.id, billet.id));
  await journaliser(tx, organizationId, userId, "billet.annuler", billet.id, { numero: billet.numero, motif });
  return { numero: billet.numero, ecriture: numeroEcriture };
}

/**
 * Fait avancer un départ : ouverture de l'embarquement, départ, annulation.
 *
 * Au départ, les billets encore « valides » deviennent « non présentés » : la
 * place est perdue, la recette reste. À l'annulation, chaque billet valide est
 * annulé et contrepassé, embarqué ou non — le transporteur rembourse.
 */
export async function changerStatutDepartDans(
  tx: Transaction,
  organizationId: string,
  departId: string,
  vers: StatutDepart,
  userId: string,
  motif?: string,
): Promise<{ reference: string; touches: number }> {
  const { depart, ligne } = await lireDepart(tx, organizationId, departId);
  if (!transitionPermise(depart.statut, vers)) {
    throw new Error(`Un départ « ${depart.statut} » ne passe pas « ${vers} ».`);
  }
  if (vers === "annule" && (!motif || motif.trim().length < 3)) throw new Error("Indiquez le motif de l'annulation.");

  let touches = 0;
  if (vers === "parti") {
    const absents = await tx
      .update(billets)
      .set({ statut: "non_presente", updatedAt: new Date(), version: sql`${billets.version} + 1` })
      .where(and(eq(billets.departId, depart.id), eq(billets.statut, "valide")))
      .returning({ id: billets.id });
    touches = absents.length;
  }

  if (vers === "annule") {
    const valides = await tx
      .select()
      .from(billets)
      .where(and(eq(billets.departId, depart.id), inArray(billets.statut, ["valide", "embarque"])))
      .for("update");
    for (const billet of valides) {
      await annulerUnBillet(tx, organizationId, { billet, depart, ligne }, `Départ annulé : ${motif!.trim()}`, userId, true);
    }
    touches = valides.length;
  }

  await tx
    .update(departs)
    .set({
      statut: vers,
      motif: vers === "annule" ? motif!.trim() : depart.motif,
      updatedAt: new Date(),
      version: sql`${departs.version} + 1`,
    })
    .where(eq(departs.id, depart.id));
  await journaliser(tx, organizationId, userId, `depart.${vers}`, depart.id, { reference: depart.reference, touches });
  return { reference: depart.reference, touches };
}
