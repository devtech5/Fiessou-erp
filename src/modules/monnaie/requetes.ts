import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";

import { COMPTE_EXPLOITANT, RESEAUX, SEUIL_FLOAT_BAS, soldes, type Soldes } from "./calcul";
import { floatsSession, operationsGuichet, sessionsGuichet, type Reseau, type TypeOperationGuichet } from "./schema";

export interface OperationVue {
  id: string;
  numero: string;
  type: TypeOperationGuichet;
  reseau: Reseau;
  telephone: string | null;
  montant: number;
  commission: number;
  referenceOperateur: string | null;
  le: Date;
  annulee: boolean;
  motif: string | null;
}

export interface GuichetVue {
  session: {
    id: string;
    numero: string;
    ouverteLe: Date;
    fondCaisse: number;
    /** Apport (positif) ou prélèvement (négatif) passé à l'ouverture, avec son écriture. */
    apport: { ecriture: string; montant: number } | null;
  };
  ouvertures: Record<Reseau, number>;
  operations: OperationVue[];
  soldes: Soldes;
}

async function operationsDe(sessionId: string): Promise<OperationVue[]> {
  const lignes = await db
    .select()
    .from(operationsGuichet)
    .where(eq(operationsGuichet.sessionId, sessionId))
    .orderBy(desc(operationsGuichet.createdAt));
  return lignes.map((o) => ({
    id: o.id,
    numero: o.numero,
    type: o.type,
    reseau: o.reseau,
    telephone: o.telephone,
    montant: o.montant,
    commission: o.commission,
    referenceOperateur: o.referenceOperateur,
    le: o.createdAt,
    annulee: o.annuleeLe !== null,
    motif: o.motif,
  }));
}

/** Montant porté au compte de l'exploitant par l'écriture d'ouverture : crédit = apport. */
async function apportDe(
  organizationId: string,
  numero: string | null,
): Promise<{ ecriture: string; montant: number } | null> {
  if (!numero) return null;
  const [ligne] = await db.execute<{ montant: string }>(sql`
    select coalesce(sum(l.credit - l.debit), 0) as montant
    from lignes_ecriture l join ecritures e on e.id = l.ecriture_id
    where e.organization_id = ${organizationId} and e.numero = ${numero} and l.compte = ${COMPTE_EXPLOITANT.numero}
  `);
  return { ecriture: numero, montant: Number(ligne?.montant ?? 0) };
}

/** Le guichet ouvert, ses opérations et ses soldes courants ; `null` s'il est fermé. */
export async function guichetOuvert(organizationId: string): Promise<GuichetVue | null> {
  const [session] = await db
    .select()
    .from(sessionsGuichet)
    .where(and(eq(sessionsGuichet.organizationId, organizationId), eq(sessionsGuichet.statut, "ouverte")));
  if (!session) return null;

  const [floats, operations, apport] = await Promise.all([
    db.select().from(floatsSession).where(eq(floatsSession.sessionId, session.id)),
    operationsDe(session.id),
    apportDe(organizationId, session.ecritureOuverture),
  ]);
  const ouvertures = Object.fromEntries(RESEAUX.map((r) => [r, floats.find((f) => f.reseau === r)?.ouverture ?? 0])) as Record<
    Reseau,
    number
  >;

  return {
    session: { id: session.id, numero: session.numero, ouverteLe: session.ouverteLe, fondCaisse: session.fondCaisse, apport },
    ouvertures,
    operations,
    soldes: soldes(
      { floats: ouvertures, fondCaisse: session.fondCaisse },
      operations.map((o) => ({ ...o, annulee: o.annulee })),
    ),
  };
}

/**
 * Ce que l'ouverture propose : les soldes relevés à la dernière clôture. On
 * repart de ce qu'on a compté hier soir, pas d'une page blanche.
 */
export async function soldesDerniereCloture(
  organizationId: string,
): Promise<{ fondCaisse: number; floats: Record<Reseau, number> } | null> {
  const [derniere] = await db
    .select()
    .from(sessionsGuichet)
    .where(and(eq(sessionsGuichet.organizationId, organizationId), eq(sessionsGuichet.statut, "cloturee")))
    .orderBy(desc(sessionsGuichet.clotureeLe))
    .limit(1);
  if (!derniere) return null;
  const [floats, operations] = await Promise.all([
    db.select().from(floatsSession).where(eq(floatsSession.sessionId, derniere.id)),
    db
      .select()
      .from(operationsGuichet)
      .where(and(eq(operationsGuichet.sessionId, derniere.id), isNull(operationsGuichet.annuleeLe))),
  ]);
  // Un réseau relevé à la clôture repart de son relevé ; un réseau non relevé,
  // du solde que ses opérations laissaient — pas de celui du matin.
  const attendus = soldes(
    { floats: Object.fromEntries(floats.map((f) => [f.reseau, f.ouverture])), fondCaisse: derniere.fondCaisse },
    operations,
  ).floats;
  return {
    fondCaisse: derniere.especesComptees ?? derniere.fondCaisse,
    floats: Object.fromEntries(
      RESEAUX.map((r) => [r, floats.find((x) => x.reseau === r)?.releveCloture ?? attendus[r]]),
    ) as Record<Reseau, number>,
  };
}

export interface SessionVue {
  id: string;
  numero: string;
  ouverteLe: Date;
  clotureeLe: Date | null;
  fondCaisse: number;
  especesComptees: number | null;
  ecartEspeces: number | null;
  ecriture: string | null;
  /** Apport ou prélèvement de l'exploitant constaté à l'ouverture. */
  ecritureOuverture: string | null;
  operations: number;
  commissions: number;
}

export async function historiqueSessions(organizationId: string, limite = 10): Promise<SessionVue[]> {
  const sessions = await db
    .select()
    .from(sessionsGuichet)
    .where(and(eq(sessionsGuichet.organizationId, organizationId), eq(sessionsGuichet.statut, "cloturee")))
    .orderBy(desc(sessionsGuichet.clotureeLe))
    .limit(limite);

  return Promise.all(
    sessions.map(async (s) => {
      const ops = await db
        .select({ commission: operationsGuichet.commission, annulee: operationsGuichet.annuleeLe })
        .from(operationsGuichet)
        .where(eq(operationsGuichet.sessionId, s.id))
        .orderBy(asc(operationsGuichet.createdAt));
      const valides = ops.filter((o) => o.annulee === null);
      return {
        id: s.id,
        numero: s.numero,
        ouverteLe: s.ouverteLe,
        clotureeLe: s.clotureeLe,
        fondCaisse: s.fondCaisse,
        especesComptees: s.especesComptees,
        ecartEspeces: s.ecartEspeces,
        ecriture: s.ecriture,
        ecritureOuverture: s.ecritureOuverture,
        operations: valides.length,
        commissions: valides.reduce((somme, o) => somme + o.commission, 0),
      };
    }),
  );
}

/** Pour le tableau de bord : les réseaux dont le float est bas au guichet ouvert. */
export async function floatsBas(organizationId: string): Promise<Reseau[]> {
  const guichet = await guichetOuvert(organizationId);
  if (!guichet) return [];
  return RESEAUX.filter((r) => guichet.soldes.floats[r] < SEUIL_FLOAT_BAS);
}

export async function aUneSession(organizationId: string): Promise<boolean> {
  const [session] = await db
    .select({ id: sessionsGuichet.id })
    .from(sessionsGuichet)
    .where(eq(sessionsGuichet.organizationId, organizationId))
    .limit(1);
  return Boolean(session);
}
