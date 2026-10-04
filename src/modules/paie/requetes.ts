import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";

import { echeanceDeclarations } from "./calcul";
import { bulletinsPaie, periodesPaie } from "./schema";

export async function listerPeriodes(organizationId: string) {
  const periodes = await db.select().from(periodesPaie).where(eq(periodesPaie.organizationId, organizationId)).orderBy(desc(periodesPaie.mois)).limit(36);
  const payes = await db.execute<{ periode_id: string; total: string; payes: string }>(sql`
    select periode_id, count(*) as total, count(*) filter (where paye_le is not null) as payes
    from bulletins_paie where organization_id = ${organizationId} group by periode_id
  `);
  const parPeriode = new Map(payes.map((p) => [p.periode_id, { total: Number(p.total), payes: Number(p.payes) }]));
  return periodes.map((p) => ({ ...p, bulletins: parPeriode.get(p.id)?.total ?? 0, payes: parPeriode.get(p.id)?.payes ?? 0 }));
}

export async function periodeDetail(organizationId: string, mois: string) {
  const [periode] = await db.select().from(periodesPaie).where(and(eq(periodesPaie.organizationId, organizationId), eq(periodesPaie.mois, mois)));
  if (!periode) return null;
  const bulletins = await db.select().from(bulletinsPaie).where(eq(bulletinsPaie.periodeId, periode.id)).orderBy(asc(bulletinsPaie.matricule));
  return { periode, bulletins };
}

export async function bulletinDetail(organizationId: string, id: string) {
  const [b] = await db.select().from(bulletinsPaie).where(and(eq(bulletinsPaie.id, id), eq(bulletinsPaie.organizationId, organizationId)));
  if (!b) return null;
  const [periode] = await db.select().from(periodesPaie).where(eq(periodesPaie.id, b.periodeId));
  return { bulletin: b, periode };
}

export interface EtatPaie {
  salairesNonPayes: number;
  montantNonPaye: number;
  declarationsDues: number;
  montantDeclarations: number;
  declarationsEchues: number;
}

/** Pour le tableau de bord : salaires validés non payés, versements CNPS et impôt en attente. */
export async function etatPaie(organizationId: string, aujourdhui: string): Promise<EtatPaie> {
  const [[s], periodes] = await Promise.all([
    db.execute<{ nombre: string; montant: string }>(sql`
      select count(*) as nombre, coalesce(sum(b.net), 0) as montant
      from bulletins_paie b join periodes_paie p on p.id = b.periode_id
      where b.organization_id = ${organizationId} and p.statut = 'validee' and b.paye_le is null and b.net > 0
    `),
    db
      .select({ mois: periodesPaie.mois, totalCnps: periodesPaie.totalCnps, totalImpot: periodesPaie.totalImpot, cnps: periodesPaie.cnpsVerseeLe, impot: periodesPaie.impotVerseLe })
      .from(periodesPaie)
      .where(and(eq(periodesPaie.organizationId, organizationId), eq(periodesPaie.statut, "validee"))),
  ]);
  let declarationsDues = 0;
  let montantDeclarations = 0;
  let declarationsEchues = 0;
  for (const p of periodes) {
    const echue = echeanceDeclarations(p.mois) < aujourdhui;
    if (!p.cnps && p.totalCnps > 0) {
      declarationsDues++;
      montantDeclarations += p.totalCnps;
      if (echue) declarationsEchues++;
    }
    if (!p.impot && p.totalImpot > 0) {
      declarationsDues++;
      montantDeclarations += p.totalImpot;
      if (echue) declarationsEchues++;
    }
  }
  return { salairesNonPayes: Number(s?.nombre ?? 0), montantNonPaye: Number(s?.montant ?? 0), declarationsDues, montantDeclarations, declarationsEchues };
}

/** Sorties de paie à venir, pour le plan de trésorerie. */
export async function sortiesPaie(organizationId: string, aujourdhui: string): Promise<{ date: string; montant: number; libelle: string }[]> {
  const [nets, periodes] = await Promise.all([
    db
      .select({ mois: periodesPaie.mois, montant: sql<string>`coalesce(sum(${bulletinsPaie.net}), 0)` })
      .from(bulletinsPaie)
      .innerJoin(periodesPaie, eq(periodesPaie.id, bulletinsPaie.periodeId))
      .where(and(eq(bulletinsPaie.organizationId, organizationId), eq(periodesPaie.statut, "validee"), isNull(bulletinsPaie.payeLe)))
      .groupBy(periodesPaie.mois),
    db.select().from(periodesPaie).where(and(eq(periodesPaie.organizationId, organizationId), eq(periodesPaie.statut, "validee"))),
  ]);
  const sorties: { date: string; montant: number; libelle: string }[] = [];
  for (const n of nets) if (Number(n.montant) > 0) sorties.push({ date: aujourdhui, montant: Number(n.montant), libelle: `Salaires nets de ${n.mois}` });
  for (const p of periodes) {
    const echeance = echeanceDeclarations(p.mois);
    if (!p.cnpsVerseeLe && p.totalCnps > 0) sorties.push({ date: echeance, montant: p.totalCnps, libelle: `CNPS de ${p.mois}` });
    if (!p.impotVerseLe && p.totalImpot > 0) sorties.push({ date: echeance, montant: p.totalImpot, libelle: `Impôt sur salaires de ${p.mois}` });
  }
  return sorties;
}
