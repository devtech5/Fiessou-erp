import "server-only";

import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";

import { auditLogs } from "@/db/schema";
import { newId } from "@/lib/ids";
import { prochainNumero, type Transaction } from "@/lib/sequences";
import { enregistrerEcritureDans } from "@/modules/comptabilite/enregistrement";

import {
  ecritureApportOuverture,
  ecritureClotureGuichet,
  ouvertureAttendue,
  rapprocher,
  refusOperation,
  RESEAUX,
  soldes,
  type Soldes,
} from "./calcul";
import {
  floatsSession,
  operationsGuichet,
  sessionsGuichet,
  type Reseau,
  type SessionGuichet,
  type TypeOperationGuichet,
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

/**
 * Ouvre le guichet : fond de caisse et floats comptés.
 *
 * L'index unique partiel refuse une seconde session ouverte ; le message le
 * dit avant que la base ne le fasse.
 */
export async function ouvrirSessionDans(
  tx: Transaction,
  organizationId: string,
  ouverture: { fondCaisse: number; floats: Partial<Record<Reseau, number>>; ouverteLe?: Date },
  userId?: string,
): Promise<{ id: string; numero: string }> {
  const [deja] = await tx
    .select({ numero: sessionsGuichet.numero })
    .from(sessionsGuichet)
    .where(and(eq(sessionsGuichet.organizationId, organizationId), eq(sessionsGuichet.statut, "ouverte")));
  if (deja) throw new Error(`Le guichet est déjà ouvert (${deja.numero}).`);

  const ouverteLe = ouverture.ouverteLe ?? new Date();
  const annee = jourIso(ouverteLe).slice(0, 4);
  const numero = await prochainNumero(tx, organizationId, {
    cle: "session:guichet",
    prefix: `GUI-${annee}-`,
    padding: 5,
    periode: annee,
  });

  const id = newId();
  await tx.insert(sessionsGuichet).values({
    id,
    organizationId,
    numero,
    ouverteLe,
    ouvertePar: userId ?? null,
    fondCaisse: ouverture.fondCaisse,
  });
  await tx.insert(floatsSession).values(
    RESEAUX.map((reseau) => ({ sessionId: id, organizationId, reseau, ouverture: ouverture.floats[reseau] ?? 0 })),
  );
  await journaliser(tx, organizationId, userId, "guichet.ouvrir", id, { numero, fondCaisse: ouverture.fondCaisse });
  // Ce qui arrive au guichet sans venir d'une opération vient de l'exploitant.
  if (userId) await comptabiliserOuverturesDans(tx, organizationId, userId);
  return { id, numero };
}

/**
 * Passe l'apport (ou le prélèvement) de l'exploitant de chaque session qui ne
 * l'a pas encore, dans l'ordre d'ouverture.
 *
 * La première session apporte tout son float et son fond de caisse ; les
 * suivantes, seulement l'écart avec ce que la clôture précédente a laissé.
 * Rattrape aussi les sessions ouvertes avant que la règle n'existe.
 */
export async function comptabiliserOuverturesDans(
  tx: Transaction,
  organizationId: string,
  userId: string,
): Promise<string[]> {
  const enAttente = await tx
    .select()
    .from(sessionsGuichet)
    .where(and(eq(sessionsGuichet.organizationId, organizationId), eq(sessionsGuichet.ouvertureComptabilisee, false)))
    .orderBy(asc(sessionsGuichet.ouverteLe), asc(sessionsGuichet.numero))
    .for("update");

  const passees: string[] = [];
  for (const session of enAttente) {
    const [precedente] = await tx
      .select()
      .from(sessionsGuichet)
      .where(
        and(
          eq(sessionsGuichet.organizationId, organizationId),
          eq(sessionsGuichet.statut, "cloturee"),
          lt(sessionsGuichet.ouverteLe, session.ouverteLe),
        ),
      )
      .orderBy(desc(sessionsGuichet.ouverteLe))
      .limit(1);

    let laisse: { especesComptees: number; floats: Partial<Record<Reseau, number>> } | null = null;
    if (precedente) {
      const [floats, operations] = await Promise.all([
        tx.select().from(floatsSession).where(eq(floatsSession.sessionId, precedente.id)),
        tx
          .select({
            type: operationsGuichet.type,
            reseau: operationsGuichet.reseau,
            montant: operationsGuichet.montant,
            commission: operationsGuichet.commission,
          })
          .from(operationsGuichet)
          .where(and(eq(operationsGuichet.sessionId, precedente.id), isNull(operationsGuichet.annuleeLe))),
      ]);
      const theoriques = soldes(
        { floats: Object.fromEntries(floats.map((f) => [f.reseau, f.ouverture])), fondCaisse: precedente.fondCaisse },
        operations,
      ).floats;
      laisse = {
        especesComptees: precedente.especesComptees ?? precedente.fondCaisse,
        floats: Object.fromEntries(
          RESEAUX.map((r) => [r, floats.find((f) => f.reseau === r)?.releveCloture ?? theoriques[r]]),
        ),
      };
    }

    const declares = await tx.select().from(floatsSession).where(eq(floatsSession.sessionId, session.id));
    const date = jourIso(session.ouverteLe);
    const ecriture = ecritureApportOuverture({
      numero: session.numero,
      date,
      declare: {
        especes: session.fondCaisse,
        floats: Object.fromEntries(declares.map((f) => [f.reseau, f.ouverture])),
      },
      attendu: ouvertureAttendue(laisse),
    });
    const numeroEcriture = ecriture
      ? await enregistrerEcritureDans(tx, ecriture, {
          organizationId,
          userId: session.ouvertePar ?? userId,
          origine: "saisie",
          pieceId: session.id,
          exercice: date.slice(0, 4),
          dateIso: date,
        })
      : null;

    await tx
      .update(sessionsGuichet)
      .set({ ouvertureComptabilisee: true, ecritureOuverture: numeroEcriture, updatedAt: new Date() })
      .where(eq(sessionsGuichet.id, session.id));
    if (numeroEcriture) passees.push(numeroEcriture);
  }
  return passees;
}

/** Session ouverte, verrouillée, avec ses soldes courants. */
async function sessionCourante(
  tx: Transaction,
  organizationId: string,
): Promise<{ session: SessionGuichet; courants: Soldes; ouvertures: Record<Reseau, number> }> {
  const [session] = await tx
    .select()
    .from(sessionsGuichet)
    .where(and(eq(sessionsGuichet.organizationId, organizationId), eq(sessionsGuichet.statut, "ouverte")))
    .for("update");
  if (!session) throw new Error("Le guichet est fermé : ouvrez une session d'abord.");

  const floats = await tx
    .select({ reseau: floatsSession.reseau, ouverture: floatsSession.ouverture })
    .from(floatsSession)
    .where(eq(floatsSession.sessionId, session.id));
  const ouvertures = Object.fromEntries(floats.map((f) => [f.reseau, f.ouverture])) as Record<Reseau, number>;

  const operations = await tx
    .select({
      type: operationsGuichet.type,
      reseau: operationsGuichet.reseau,
      montant: operationsGuichet.montant,
      commission: operationsGuichet.commission,
    })
    .from(operationsGuichet)
    .where(and(eq(operationsGuichet.sessionId, session.id), isNull(operationsGuichet.annuleeLe)))
    .orderBy(asc(operationsGuichet.createdAt));

  return { session, courants: soldes({ floats: ouvertures, fondCaisse: session.fondCaisse }, operations), ouvertures };
}

export interface NouvelleOperation {
  type: TypeOperationGuichet;
  reseau: Reseau;
  montant: number;
  commission: number;
  telephone?: string | null;
  referenceOperateur?: string | null;
}

/**
 * Enregistre une opération, après contrôle des deux réserves.
 *
 * La session est verrouillée : deux agents au même guichet qui servent chacun
 * un retrait sur les derniers 50 000 F du tiroir passent l'un après l'autre,
 * et le second est refusé.
 */
export async function enregistrerOperationDans(
  tx: Transaction,
  organizationId: string,
  op: NouvelleOperation,
  userId?: string,
): Promise<{ id: string; numero: string; soldes: Soldes }> {
  const { session, courants } = await sessionCourante(tx, organizationId);
  const refus = refusOperation(courants, op);
  if (refus) throw new Error(refus);
  if (!Number.isInteger(op.commission) || op.commission < 0) throw new Error("Commission invalide.");
  if ((op.type === "depot" || op.type === "retrait" || op.type === "credit") && !op.telephone?.trim()) {
    throw new Error("Indiquez le numéro du client.");
  }

  const annee = jourIso(session.ouverteLe).slice(0, 4);
  const numero = await prochainNumero(tx, organizationId, {
    cle: "operation:guichet",
    prefix: `OPG-${annee}-`,
    padding: 6,
    periode: annee,
  });
  const id = newId();
  await tx.insert(operationsGuichet).values({
    id,
    organizationId,
    sessionId: session.id,
    numero,
    type: op.type,
    reseau: op.reseau,
    telephone: op.telephone?.trim() || null,
    montant: op.montant,
    commission: op.commission,
    referenceOperateur: op.referenceOperateur?.trim() || null,
    userId: userId ?? null,
  });

  const apres = soldes({ floats: courants.floats, fondCaisse: courants.especes }, [op]);
  return { id, numero, soldes: { ...apres, commissions: courants.commissions + op.commission } };
}

/**
 * Annule une opération saisie par erreur, tant que la session est ouverte.
 * L'annulation ne défait rien chez l'opérateur : elle corrige le journal.
 */
export async function annulerOperationDans(
  tx: Transaction,
  organizationId: string,
  operationId: string,
  motif: string,
  userId: string,
): Promise<{ numero: string }> {
  const { session } = await sessionCourante(tx, organizationId);
  const [annulee] = await tx
    .update(operationsGuichet)
    .set({ annuleeLe: new Date(), motif, updatedAt: new Date(), version: sql`${operationsGuichet.version} + 1` })
    .where(
      and(
        eq(operationsGuichet.id, operationId),
        eq(operationsGuichet.organizationId, organizationId),
        eq(operationsGuichet.sessionId, session.id),
        isNull(operationsGuichet.annuleeLe),
      ),
    )
    .returning({ numero: operationsGuichet.numero });
  if (!annulee) throw new Error("Seule une opération de la session ouverte s'annule.");
  await journaliser(tx, organizationId, userId, "guichet.annuler_operation", operationId, { numero: annulee.numero, motif });
  return annulee;
}

/**
 * Clôture : tiroir compté, soldes relevés chez chaque opérateur, écriture
 * passée. Après elle, plus aucune opération ne s'ajoute à la session.
 */
export async function cloturerSessionDans(
  tx: Transaction,
  organizationId: string,
  cloture: { especesComptees: number; releves: Partial<Record<Reseau, number | null>>; observations?: string | null },
  userId: string,
): Promise<{ numero: string; ecartEspeces: number; ecriture: string | null }> {
  // Une session ouverte avant la règle d'apport se rattrape ici, avant de clore.
  await comptabiliserOuverturesDans(tx, organizationId, userId);
  const { session, courants, ouvertures } = await sessionCourante(tx, organizationId);
  const r = rapprocher(courants, cloture.especesComptees, cloture.releves);

  const aujourdHui = jourIso(new Date());
  const ecriture = ecritureClotureGuichet({
    numero: session.numero,
    date: aujourdHui,
    variationsFloat: Object.fromEntries(RESEAUX.map((reseau) => [reseau, courants.floats[reseau] - ouvertures[reseau]])),
    commissions: courants.commissions,
    ecartEspeces: r.ecartEspeces,
  });
  const numeroEcriture = ecriture
    ? await enregistrerEcritureDans(tx, ecriture, {
        organizationId,
        userId,
        origine: "saisie",
        pieceId: session.id,
        exercice: aujourdHui.slice(0, 4),
        dateIso: aujourdHui,
      })
    : null;

  for (const reseau of RESEAUX) {
    const releve = cloture.releves[reseau];
    if (releve === undefined || releve === null) continue;
    await tx
      .update(floatsSession)
      .set({ releveCloture: releve, updatedAt: new Date() })
      .where(and(eq(floatsSession.sessionId, session.id), eq(floatsSession.reseau, reseau)));
  }

  await tx
    .update(sessionsGuichet)
    .set({
      statut: "cloturee",
      clotureeLe: new Date(),
      cloturePar: userId,
      especesComptees: cloture.especesComptees,
      ecartEspeces: r.ecartEspeces,
      ecriture: numeroEcriture,
      observations: cloture.observations?.trim() || null,
      updatedAt: new Date(),
      version: sql`${sessionsGuichet.version} + 1`,
    })
    .where(eq(sessionsGuichet.id, session.id));

  await journaliser(tx, organizationId, userId, "guichet.cloturer", session.id, {
    numero: session.numero,
    ecartEspeces: r.ecartEspeces,
  });
  return { numero: session.numero, ecartEspeces: r.ecartEspeces, ecriture: numeroEcriture };
}
