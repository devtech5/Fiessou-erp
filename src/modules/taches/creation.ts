import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { auditLogs, memberships } from "@/db/schema";
import { newId } from "@/lib/ids";
import { prochainNumero, type Transaction } from "@/lib/sequences";

import { gestePermis, statutApres, type Acteur, type Geste, type Priorite } from "./calcul";
import { taches } from "./schema";

async function journaliser(
  tx: Transaction,
  organizationId: string,
  userId: string,
  action: string,
  tacheId: string,
  apres: Record<string, unknown>,
  avant?: Record<string, unknown>,
) {
  await tx.insert(auditLogs).values({
    id: newId(),
    organizationId,
    userId,
    action,
    entityType: "tache",
    entityId: tacheId,
    before: avant ?? null,
    after: apres,
  });
}

/** L'exécutant doit être un membre actif de l'entreprise. */
async function verifierMembre(tx: Transaction, organizationId: string, userId: string): Promise<void> {
  const [membre] = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.userId, userId),
        eq(memberships.status, "actif"),
      ),
    );
  if (!membre) throw new Error("Cette personne n'a pas d'accès actif à l'entreprise.");
}

export interface NouvelleTache {
  titre: string;
  description?: string | null;
  priorite: Priorite;
  echeance?: string | null;
  /** Exécutant. Absent : la tâche est pour soi. */
  assigneeUserId?: string | null;
}

/**
 * Crée une tâche. Attribuer à quelqu'un d'autre que soi exige le droit
 * d'attribuer : l'appelant le dit par `acteur.attribue`.
 */
export async function creerTacheDans(
  tx: Transaction,
  organizationId: string,
  donnees: NouvelleTache,
  acteur: Acteur,
): Promise<{ id: string; numero: string }> {
  const assignee = donnees.assigneeUserId ?? acteur.userId;
  if (assignee !== acteur.userId) {
    if (!acteur.attribue) throw new Error("Votre rôle ne permet pas d'attribuer une tâche à quelqu'un d'autre.");
    await verifierMembre(tx, organizationId, assignee);
  }

  const annee = String(new Date().getUTCFullYear());
  const numero = await prochainNumero(tx, organizationId, { cle: "tache", prefix: `TCH-${annee}-`, padding: 5, periode: annee });
  const id = newId();
  await tx.insert(taches).values({
    id,
    organizationId,
    numero,
    titre: donnees.titre.trim(),
    description: donnees.description?.trim() || null,
    priorite: donnees.priorite,
    echeance: donnees.echeance ?? null,
    creeParUserId: acteur.userId,
    assigneeUserId: assignee,
  });
  await journaliser(tx, organizationId, acteur.userId, "tache.creer", id, {
    numero,
    titre: donnees.titre,
    priorite: donnees.priorite,
    echeance: donnees.echeance ?? null,
    assigneeUserId: assignee,
  });
  if (assignee !== acteur.userId) {
    await journaliser(tx, organizationId, acteur.userId, "tache.attribuer", id, { numero, assigneeUserId: assignee });
  }
  return { id, numero };
}

async function tacheVerrouillee(tx: Transaction, organizationId: string, tacheId: string) {
  const [tache] = await tx
    .select()
    .from(taches)
    .where(and(eq(taches.id, tacheId), eq(taches.organizationId, organizationId)))
    .for("update");
  if (!tache) throw new Error("Tâche introuvable.");
  return tache;
}

/**
 * Fait avancer une tâche. La ligne est verrouillée : deux personnes qui
 * terminent la même tâche au même moment n'écrivent pas deux comptes rendus.
 */
export async function appliquerGesteDans(
  tx: Transaction,
  organizationId: string,
  tacheId: string,
  geste: Geste,
  acteur: Acteur,
  texte?: string | null,
): Promise<{ numero: string }> {
  const tache = await tacheVerrouillee(tx, organizationId, tacheId);
  if (!gestePermis(geste, tache, acteur)) throw new Error("Ce geste n'est pas le vôtre sur cette tâche.");
  const vers = statutApres(geste, tache.statut);
  if (!vers) throw new Error(`${tache.numero} : impossible depuis l'état actuel.`);
  if (geste === "annuler" && (!texte || texte.trim().length < 3)) throw new Error("Indiquez le motif de l'annulation.");

  const maintenant = new Date();
  await tx
    .update(taches)
    .set({
      statut: vers,
      ...(geste === "demarrer" ? { demarreeLe: maintenant } : {}),
      ...(geste === "terminer"
        ? {
            termineeLe: maintenant,
            termineeParUserId: acteur.userId,
            compteRendu: texte?.trim() || null,
            demarreeLe: tache.demarreeLe ?? maintenant,
          }
        : {}),
      ...(geste === "annuler" ? { annuleeLe: maintenant, motifAnnulation: texte!.trim() } : {}),
      ...(geste === "rouvrir"
        ? { termineeLe: null, termineeParUserId: null, annuleeLe: null, motifAnnulation: null, demarreeLe: null }
        : {}),
      updatedAt: maintenant,
      version: sql`${taches.version} + 1`,
    })
    .where(eq(taches.id, tacheId));

  await journaliser(
    tx,
    organizationId,
    acteur.userId,
    `tache.${geste}`,
    tacheId,
    { numero: tache.numero, statut: vers, ...(texte?.trim() ? { [geste === "annuler" ? "motif" : "compteRendu"]: texte.trim() } : {}) },
    { statut: tache.statut },
  );
  return { numero: tache.numero };
}

export interface ModificationTache {
  titre: string;
  description?: string | null;
  priorite: Priorite;
  echeance?: string | null;
  assigneeUserId: string;
}

/**
 * Modifie une tâche ouverte : son contenu, son échéance, son exécutant.
 * Le créateur et qui attribue la modifient ; changer d'exécutant exige
 * d'attribuer. Le journal garde l'avant et l'après.
 */
export async function modifierTacheDans(
  tx: Transaction,
  organizationId: string,
  tacheId: string,
  donnees: ModificationTache,
  acteur: Acteur,
): Promise<{ numero: string }> {
  const tache = await tacheVerrouillee(tx, organizationId, tacheId);
  if (!acteur.attribue && tache.creeParUserId !== acteur.userId) {
    throw new Error("Seul le créateur de la tâche, ou qui attribue les tâches, peut la modifier.");
  }
  if (tache.statut === "terminee" || tache.statut === "annulee") {
    throw new Error(`${tache.numero} est close : rouvrez-la pour la modifier.`);
  }

  const reattribuee = donnees.assigneeUserId !== tache.assigneeUserId;
  if (reattribuee) {
    if (!acteur.attribue && donnees.assigneeUserId !== acteur.userId) {
      throw new Error("Votre rôle ne permet pas d'attribuer une tâche à quelqu'un d'autre.");
    }
    await verifierMembre(tx, organizationId, donnees.assigneeUserId);
  }

  const maintenant = new Date();
  await tx
    .update(taches)
    .set({
      titre: donnees.titre.trim(),
      description: donnees.description?.trim() || null,
      priorite: donnees.priorite,
      echeance: donnees.echeance ?? null,
      assigneeUserId: donnees.assigneeUserId,
      ...(reattribuee ? { attribueeLe: maintenant, statut: "a_faire" as const, demarreeLe: null } : {}),
      updatedAt: maintenant,
      version: sql`${taches.version} + 1`,
    })
    .where(eq(taches.id, tacheId));

  const avant = {
    titre: tache.titre,
    priorite: tache.priorite,
    echeance: tache.echeance,
    assigneeUserId: tache.assigneeUserId,
  };
  const apres = {
    numero: tache.numero,
    titre: donnees.titre,
    priorite: donnees.priorite,
    echeance: donnees.echeance ?? null,
    assigneeUserId: donnees.assigneeUserId,
  };
  await journaliser(tx, organizationId, acteur.userId, reattribuee ? "tache.attribuer" : "tache.modifier", tacheId, apres, avant);
  return { numero: tache.numero };
}
