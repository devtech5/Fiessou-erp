import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { newId } from "@/lib/ids";
import { prochainNumero } from "@/lib/sequences";
import { cheminDe, deposer, lireFichier, supprimer } from "@/lib/stockage";

import { refusEnvoi, retraitPossible } from "./calcul";
import { empreinte } from "./empreinte";
import { archives } from "./schema";

export interface FichierArchive {
  nom: string;
  typeMime: string;
  contenu: ArrayBuffer;
}

export interface NouvelEnvoi {
  /** Titre de l'archive. Ne sert que pour un fichier seul : un lot garde les noms de fichier. */
  titre?: string | null;
  dossier?: string | null;
  description?: string | null;
  fichiers: FichierArchive[];
}

async function journaliser(
  organizationId: string,
  userId: string,
  action: string,
  archiveId: string,
  apres: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({
    id: newId(),
    organizationId,
    userId,
    action,
    entityType: "archive",
    entityId: archiveId,
    after: apres,
  });
}

/** Octets occupés par l'espace d'une personne. Les archives retirées n'y comptent plus. */
export async function espaceUtilise(organizationId: string, userId: string): Promise<number> {
  const [ligne] = await db
    .select({ total: sql<string>`coalesce(sum(${archives.tailleOctets}), 0)` })
    .from(archives)
    .where(and(eq(archives.organizationId, organizationId), eq(archives.userId, userId), isNull(archives.retireeLe)));
  return Number(ligne?.total ?? 0);
}

const sansExtension = (nom: string) => (nom.includes(".") ? nom.slice(0, nom.lastIndexOf(".")) : nom).trim() || nom;
const extensionDe = (nom: string) => (nom.includes(".") ? nom.split(".").pop()! : "");

/**
 * Archive un lot de fichiers dans l'espace de la personne.
 *
 * Tout le lot est contrôlé avant le premier dépôt. Ensuite, fichier par
 * fichier : le fichier part au dépôt, puis la fiche s'écrit avec son numéro.
 * Si la fiche échoue, le fichier est retiré — jamais de fichier sans fiche.
 *
 * L'empreinte est prise sur les octets REÇUS, avant le dépôt : c'est elle qui
 * fait foi, et non ce que le dépôt dira avoir stocké.
 */
export async function archiverPour(
  organizationId: string,
  userId: string,
  envoi: NouvelEnvoi,
): Promise<{ numeros: string[] }> {
  const refus = refusEnvoi(
    envoi.fichiers.map((f) => ({ nom: f.nom, typeMime: f.typeMime, taille: f.contenu.byteLength })),
    await espaceUtilise(organizationId, userId),
  );
  if (refus) throw new Error(refus);

  const seul = envoi.fichiers.length === 1;
  const numeros: string[] = [];

  for (const fichier of envoi.fichiers) {
    const id = newId();
    const chemin = cheminDe(organizationId, id, extensionDe(fichier.nom));
    const sceau = empreinte(fichier.contenu);

    const depot = await deposer({ chemin, contenu: fichier.contenu, typeMime: fichier.typeMime });
    if (!depot.ok) throw new Error(numeros.length ? `${depot.raison} (${numeros.length} fichier(s) déjà archivé(s))` : depot.raison);

    try {
      const numero = await db.transaction(async (tx) => {
        const annee = String(new Date().getUTCFullYear());
        const attribue = await prochainNumero(tx, organizationId, {
          cle: "archive",
          prefix: `ARC-${annee}-`,
          padding: 5,
          periode: annee,
        });
        await tx.insert(archives).values({
          id,
          organizationId,
          numero: attribue,
          userId,
          titre: (seul && envoi.titre?.trim()) || sansExtension(fichier.nom),
          dossier: envoi.dossier?.trim() || null,
          description: envoi.description?.trim() || null,
          chemin,
          nomFichier: fichier.nom,
          typeMime: fichier.typeMime,
          tailleOctets: fichier.contenu.byteLength,
          empreinte: sceau,
        });
        await tx.insert(auditLogs).values({
          id: newId(),
          organizationId,
          userId,
          action: "archive.deposer",
          entityType: "archive",
          entityId: id,
          after: { numero: attribue, fichier: fichier.nom, taille: fichier.contenu.byteLength, empreinte: sceau },
        });
        return attribue;
      });
      numeros.push(numero);
    } catch (erreur) {
      await supprimer(chemin);
      throw erreur;
    }
  }

  return { numeros };
}

/**
 * Retrait par l'auteur, dans le délai de correction.
 *
 * Le fichier reste dans le dépôt et la fiche en base : l'administrateur légal
 * continue de les voir, avec la date et le motif du retrait.
 */
export async function retirerArchivePour(
  organizationId: string,
  userId: string,
  archiveId: string,
  motif: string,
): Promise<{ numero: string }> {
  const [archive] = await db
    .select({ numero: archives.numero, deposeLe: archives.createdAt, retireeLe: archives.retireeLe })
    .from(archives)
    .where(and(eq(archives.id, archiveId), eq(archives.organizationId, organizationId), eq(archives.userId, userId)));

  if (!archive) throw new Error("Archive introuvable dans votre espace.");
  if (archive.retireeLe) throw new Error(`${archive.numero} est déjà retirée.`);
  if (!retraitPossible(archive.deposeLe)) {
    throw new Error(`${archive.numero} est scellée : le délai de retrait est passé.`);
  }

  await db
    .update(archives)
    .set({ retireeLe: new Date(), motifRetrait: motif, updatedAt: new Date(), version: sql`${archives.version} + 1` })
    .where(and(eq(archives.id, archiveId), eq(archives.organizationId, organizationId)));
  await journaliser(organizationId, userId, "archive.retirer", archiveId, { numero: archive.numero, motif });

  return { numero: archive.numero };
}

/** Une archive, lue pour l'ouvrir ou la vérifier. */
async function archiveDe(organizationId: string, archiveId: string) {
  const [archive] = await db
    .select({
      numero: archives.numero,
      userId: archives.userId,
      chemin: archives.chemin,
      empreinte: archives.empreinte,
      retireeLe: archives.retireeLe,
    })
    .from(archives)
    .where(and(eq(archives.id, archiveId), eq(archives.organizationId, organizationId)));
  return archive ?? null;
}

/**
 * Autorise l'ouverture et la journalise.
 *
 * L'auteur ouvre ce qu'il n'a pas retiré ; l'administrateur légal ouvre tout.
 * Chaque ouverture laisse une ligne : l'auteur voit qu'on a consulté son
 * archive, l'administrateur répond de ses consultations.
 */
export async function autoriserOuverture(
  organizationId: string,
  userId: string,
  archiveId: string,
  superviseur: boolean,
): Promise<string | null> {
  const archive = await archiveDe(organizationId, archiveId);
  if (!archive) return null;

  const sienne = archive.userId === userId && !archive.retireeLe;
  if (!sienne && !superviseur) return null;

  await journaliser(organizationId, userId, "archive.ouvrir", archiveId, {
    numero: archive.numero,
    parAdministrateur: archive.userId !== userId,
  });
  return archive.chemin;
}

export type ResultatVerification =
  | { etat: "conforme"; numero: string }
  | { etat: "altere"; numero: string; attendue: string; trouvee: string }
  | { etat: "absent"; numero: string };

/**
 * Relit le fichier dans le dépôt et compare son empreinte à celle du dépôt.
 * Le résultat est journalisé, conforme ou non : une vérification est une preuve.
 */
export async function verifierArchivePour(
  organizationId: string,
  userId: string,
  archiveId: string,
): Promise<ResultatVerification> {
  const archive = await archiveDe(organizationId, archiveId);
  if (!archive) throw new Error("Archive introuvable.");

  const contenu = await lireFichier(archive.chemin);
  const resultat: ResultatVerification = !contenu
    ? { etat: "absent", numero: archive.numero }
    : empreinte(contenu) === archive.empreinte
      ? { etat: "conforme", numero: archive.numero }
      : { etat: "altere", numero: archive.numero, attendue: archive.empreinte, trouvee: empreinte(contenu) };

  await journaliser(organizationId, userId, "archive.verifier", archiveId, { numero: archive.numero, etat: resultat.etat });
  return resultat;
}
