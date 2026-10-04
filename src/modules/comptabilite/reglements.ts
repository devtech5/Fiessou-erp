"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { auditLogs, documentSequences, ecritures, lignesEcriture } from "@/db/schema";
import { exigerEntreprise } from "@/lib/auth/dal";
import {
  MESSAGE_REFUS,
  verifierLettrage,
  versLettres,
  type LigneLettrable,
} from "@/lib/comptabilite/lettrage";
import { newId } from "@/lib/ids";

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
