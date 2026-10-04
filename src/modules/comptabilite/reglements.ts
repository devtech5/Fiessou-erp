"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { auditLogs, documentSequences, ecritures, lignesEcriture } from "@/db/schema";
import { exigerEntreprise } from "@/lib/auth/dal";
import { COMPTES, ecritureReglement, type MoyenReglement } from "@/lib/comptabilite/ecritures";
import {
  MESSAGE_REFUS,
  verifierLettrage,
  versLettres,
  type LigneLettrable,
} from "@/lib/comptabilite/lettrage";
import { DOCUMENTS, totalTTC } from "@/lib/fixtures/gestion";
import { buildDocumentNumber, newId } from "@/lib/ids";
import { violeContrainte } from "@/lib/erreurs-pg";

export type Resultat =
  | { ok: true; numero: string; lettrage?: string }
  | { ok: false; message: string };

/** Lignes du compte client d'un tiers, avec leur état de lettrage. */
export async function lignesTiers(auxiliaire: string): Promise<
  (LigneLettrable & { piece: string; date: string; libelle: string })[]
> {
  const session = await exigerEntreprise();

  const lignes = await db
    .select({
      id: lignesEcriture.id,
      compte: lignesEcriture.compte,
      auxiliaire: lignesEcriture.auxiliaire,
      debit: lignesEcriture.debit,
      credit: lignesEcriture.credit,
      lettrage: lignesEcriture.lettrage,
      piece: ecritures.pieceNumero,
      date: ecritures.dateEcriture,
      libelle: ecritures.libelle,
    })
    .from(lignesEcriture)
    .innerJoin(ecritures, eq(ecritures.id, lignesEcriture.ecritureId))
    .where(
      and(
        eq(lignesEcriture.organizationId, session.organizationId),
        eq(lignesEcriture.auxiliaire, auxiliaire),
      ),
    )
    .orderBy(ecritures.dateEcriture);

  return lignes.map((l) => ({ ...l, date: String(l.date) }));
}

/**
 * Prochain code de lettrage de l'entreprise.
 *
 * Incrémenté dans la transaction, comme la numérotation des écritures : deux
 * lettrages simultanés qui obtiendraient le même code rapprocheraient des
 * lignes sans rapport entre elles.
 */
async function prochainCode(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
): Promise<string> {
  const cle = "lettrage";

  const existants = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(
      and(
        eq(documentSequences.organizationId, organizationId),
        eq(documentSequences.key, cle),
      ),
    )
    .returning({ valeur: documentSequences.nextValue });

  if (existants.length > 0) return versLettres(existants[0].valeur - 1);

  await tx.insert(documentSequences).values({
    id: newId(),
    organizationId,
    key: cle,
    scope: "",
    periodicity: "aucune",
    periodKey: "",
    nextValue: 2,
  });

  return versLettres(1);
}

/**
 * Encaisse une facture et lettre le règlement contre elle.
 *
 * Les deux opérations tiennent dans une seule transaction, et c'est essentiel :
 * un règlement enregistré sans lettrage laisserait la facture dans l'encours
 * alors qu'elle est payée, et le client serait relancé pour une somme déjà
 * reçue.
 *
 * Le lettrage n'est posé que si le règlement solde exactement la facture. Un
 * paiement partiel laisse les deux lignes ouvertes : marquer soldée une
 * facture à moitié payée est précisément l'erreur que le lettrage sert à
 * éviter.
 */
export async function encaisserFacture(
  documentId: string,
  moyen: MoyenReglement,
): Promise<Resultat> {
  const session = await exigerEntreprise();

  const document = DOCUMENTS.find((d) => d.id === documentId);
  if (!document) return { ok: false, message: "Pièce introuvable." };
  if (document.nature !== "facture") {
    return { ok: false, message: "Seule une facture s'encaisse." };
  }

  const montant = totalTTC(document);
  const numeroReglement = `REG-${document.numero.slice(-9)}`;

  try {
    const ecriture = ecritureReglement({
      numero: numeroReglement,
      date: document.date,
      client: document.client,
      compteAuxiliaire: document.compteAuxiliaire,
      montant,
      moyen,
    });

    const resultat = await db.transaction(async (tx) => {
      // La facture doit être comptabilisée : sans sa créance au débit, il n'y
      // a rien à solder et le règlement resterait suspendu.
      const facture = await tx
        .select({ id: ecritures.id })
        .from(ecritures)
        .where(
          and(
            eq(ecritures.organizationId, session.organizationId),
            eq(ecritures.pieceNumero, document.numero),
            eq(ecritures.origine, "facture"),
          ),
        )
        .limit(1);

      if (facture.length === 0) {
        throw new Error("NON_COMPTABILISEE");
      }

      const numero = await prochainNumeroJournal(
        tx,
        session.organizationId,
        ecriture.journal,
        document.date.slice(-4),
      );

      const ecritureId = newId();
      const [jour, mois, annee] = document.date.split("/");

      await tx.insert(ecritures).values({
        id: ecritureId,
        organizationId: session.organizationId,
        journal: ecriture.journal,
        numero,
        exercice: annee,
        dateEcriture: `${annee}-${mois}-${jour}`,
        libelle: ecriture.libelle,
        origine: "reglement",
        pieceNumero: numeroReglement,
        passeeParUserId: session.userId,
      });

      await tx.insert(lignesEcriture).values(
        ecriture.lignes.map((ligne, index) => ({
          id: newId(),
          ecritureId,
          organizationId: session.organizationId,
          compte: ligne.compte,
          libelleCompte: ligne.libelleCompte,
          auxiliaire: ligne.auxiliaire ?? null,
          debit: ligne.debit,
          credit: ligne.credit,
          ordre: index,
        })),
      );

      // Lettrage : la créance de la facture contre le crédit du règlement.
      const aLettrer = await tx
        .select({
          id: lignesEcriture.id,
          compte: lignesEcriture.compte,
          auxiliaire: lignesEcriture.auxiliaire,
          debit: lignesEcriture.debit,
          credit: lignesEcriture.credit,
          lettrage: lignesEcriture.lettrage,
        })
        .from(lignesEcriture)
        .where(
          and(
            eq(lignesEcriture.organizationId, session.organizationId),
            eq(lignesEcriture.compte, COMPTES.clients.numero),
            eq(lignesEcriture.auxiliaire, document.compteAuxiliaire),
            sql`${lignesEcriture.lettrage} is null`,
          ),
        );

      const controle = verifierLettrage(aLettrer);
      let code: string | undefined;

      if (controle.ok) {
        code = await prochainCode(tx, session.organizationId);
        await tx
          .update(lignesEcriture)
          .set({ lettrage: code, updatedAt: new Date() })
          .where(
            inArray(
              lignesEcriture.id,
              aLettrer.map((l) => l.id),
            ),
          );
      }

      await tx.insert(auditLogs).values({
        id: newId(),
        organizationId: session.organizationId,
        userId: session.userId,
        action: "reglement.encaisser",
        entityType: "ecriture",
        entityId: ecritureId,
        after: { numero, montant, moyen, lettrage: code ?? null },
      });

      return { numero, lettrage: code };
    });

    revalidatePath("/commercial/ventes");
    revalidatePath("/comptabilite");
    return { ok: true, ...resultat };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);

    if (message.includes("NON_COMPTABILISEE")) {
      return {
        ok: false,
        message: "Comptabilisez d'abord la facture : sans créance, rien à solder.",
      };
    }
    if (violeContrainte(erreur, "ecritures_piece_unique")) {
      return { ok: false, message: "Ce règlement est déjà enregistré." };
    }

    console.error("Échec d'encaissement", erreur);
    return { ok: false, message: "Le règlement n'a pas pu être enregistré." };
  }
}

/** Lettrage manuel d'un ensemble de lignes choisies. */
export async function lettrerLignes(ligneIds: string[]): Promise<Resultat> {
  const session = await exigerEntreprise();

  try {
    const code = await db.transaction(async (tx) => {
      const lignes = await tx
        .select({
          id: lignesEcriture.id,
          compte: lignesEcriture.compte,
          auxiliaire: lignesEcriture.auxiliaire,
          debit: lignesEcriture.debit,
          credit: lignesEcriture.credit,
          lettrage: lignesEcriture.lettrage,
        })
        .from(lignesEcriture)
        .where(
          and(
            eq(lignesEcriture.organizationId, session.organizationId),
            inArray(lignesEcriture.id, ligneIds),
          ),
        );

      const controle = verifierLettrage(lignes);
      if (!controle.ok) throw new Error(`REFUS:${controle.raison}`);

      const attribue = await prochainCode(tx, session.organizationId);

      await tx
        .update(lignesEcriture)
        .set({ lettrage: attribue, updatedAt: new Date() })
        .where(inArray(lignesEcriture.id, ligneIds));

      return attribue;
    });

    revalidatePath("/comptabilite");
    return { ok: true, numero: code, lettrage: code };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);

    if (message.startsWith("REFUS:")) {
      const raison = message.slice(6) as keyof typeof MESSAGE_REFUS;
      return { ok: false, message: MESSAGE_REFUS[raison] ?? "Lettrage refusé." };
    }

    console.error("Échec de lettrage", erreur);
    return { ok: false, message: "Le lettrage n'a pas pu être enregistré." };
  }
}

/**
 * Annule un lettrage.
 *
 * Nécessaire : un règlement affecté à la mauvaise facture se corrige en
 * délettrant, jamais en supprimant l'écriture. Une comptabilité ne s'efface pas.
 */
export async function delettrer(code: string): Promise<Resultat> {
  const session = await exigerEntreprise();

  await db
    .update(lignesEcriture)
    .set({ lettrage: null, updatedAt: new Date() })
    .where(
      and(
        eq(lignesEcriture.organizationId, session.organizationId),
        eq(lignesEcriture.lettrage, code),
      ),
    );

  await db.insert(auditLogs).values({
    id: newId(),
    organizationId: session.organizationId,
    userId: session.userId,
    action: "lettrage.annuler",
    entityType: "lettrage",
    before: { code },
  });

  revalidatePath("/comptabilite");
  return { ok: true, numero: code };
}

// Réutilise la numérotation par journal définie pour les écritures.
async function prochainNumeroJournal(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  journal: string,
  exercice: string,
): Promise<string> {
  const cle = `ecriture:${journal}`;

  const existants = await tx
    .update(documentSequences)
    .set({ nextValue: sql`${documentSequences.nextValue} + 1` })
    .where(
      and(
        eq(documentSequences.organizationId, organizationId),
        eq(documentSequences.key, cle),
        eq(documentSequences.periodKey, exercice),
      ),
    )
    .returning({ valeur: documentSequences.nextValue });

  if (existants.length > 0) {
    return buildDocumentNumber({
      prefix: `${journal}-${exercice}-`,
      value: existants[0].valeur - 1,
      padding: 5,
    });
  }

  await tx.insert(documentSequences).values({
    id: newId(),
    organizationId,
    key: cle,
    scope: "",
    prefix: `${journal}-${exercice}-`,
    padding: 5,
    periodicity: "annuelle",
    periodKey: exercice,
    nextValue: 2,
  });

  return buildDocumentNumber({ prefix: `${journal}-${exercice}-`, value: 1, padding: 5 });
}
