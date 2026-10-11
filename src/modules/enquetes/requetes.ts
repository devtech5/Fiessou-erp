import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { verifierLien } from "@/lib/liens-publics";
import { projets } from "@/modules/projets/schema";

import { indiceSatisfaction, synthetiser, type QuestionEnquete, type SyntheseQuestion, type Valeurs } from "./calcul";
import { enquetes, reponsesEnquete, type StatutEnquete } from "./schema";

export interface EnqueteResume {
  id: string;
  numero: string;
  titre: string;
  statut: StatutEnquete;
  projetId: string | null;
  projetNom: string | null;
  objectif: number | null;
  reponses: number;
  reponsesTerrain: number;
  derniereReponse: Date | null;
  /** Sur 100, d'après les questions notées. Nul sans question notée ni réponse. */
  satisfaction: number | null;
}

/**
 * Les enquêtes, avec leur collecte et leur satisfaction.
 *
 * L'indice se calcule en JavaScript sur les valeurs, pas en SQL : les
 * questions notées vivent dans le JSON de chaque enquête. Le volume reste
 * celui d'une entreprise — quelques milliers de réponses, pas des millions.
 */
export async function listerEnquetes(organizationId: string, projetId?: string): Promise<EnqueteResume[]> {
  const filtres = [eq(enquetes.organizationId, organizationId), isNull(enquetes.deletedAt)];
  if (projetId) filtres.push(eq(enquetes.projetId, projetId));

  const liste = await db
    .select({ enquete: enquetes, projetNom: projets.nom })
    .from(enquetes)
    .leftJoin(projets, eq(projets.id, enquetes.projetId))
    .where(and(...filtres))
    .orderBy(desc(enquetes.createdAt));
  if (liste.length === 0) return [];

  const reponses = await db
    .select({ enqueteId: reponsesEnquete.enqueteId, canal: reponsesEnquete.canal, valeurs: reponsesEnquete.valeurs, priseLe: reponsesEnquete.priseLe })
    .from(reponsesEnquete)
    .where(
      and(
        eq(reponsesEnquete.organizationId, organizationId),
        isNull(reponsesEnquete.deletedAt),
        inArray(
          reponsesEnquete.enqueteId,
          liste.map((l) => l.enquete.id),
        ),
      ),
    );

  const parEnquete = new Map<string, typeof reponses>();
  for (const r of reponses) parEnquete.set(r.enqueteId, [...(parEnquete.get(r.enqueteId) ?? []), r]);

  return liste.map(({ enquete, projetNom }) => {
    const siennes = parEnquete.get(enquete.id) ?? [];
    return {
      id: enquete.id,
      numero: enquete.numero,
      titre: enquete.titre,
      statut: enquete.statut,
      projetId: enquete.projetId,
      projetNom,
      objectif: enquete.objectif,
      reponses: siennes.length,
      reponsesTerrain: siennes.filter((r) => r.canal === "terrain").length,
      derniereReponse: siennes.reduce<Date | null>((d, r) => (!d || r.priseLe > d ? r.priseLe : d), null),
      satisfaction: indiceSatisfaction(enquete.questions, siennes.map((r) => r.valeurs)),
    };
  });
}

export interface ReponseVue {
  id: string;
  canal: "terrain" | "lien";
  repondant: string | null;
  enqueteur: string | null;
  priseLe: Date;
  aPosition: boolean;
  valeurs: Valeurs;
}

export interface FicheEnquete {
  id: string;
  numero: string;
  titre: string;
  introduction: string | null;
  statut: StatutEnquete;
  lienPublic: boolean;
  objectif: number | null;
  projetId: string | null;
  projetNom: string | null;
  questions: QuestionEnquete[];
  reponses: ReponseVue[];
  syntheses: { question: QuestionEnquete; synthese: SyntheseQuestion }[];
  satisfaction: number | null;
}

export async function ficheEnquete(organizationId: string, enqueteId: string): Promise<FicheEnquete | null> {
  const [ligne] = await db
    .select({ enquete: enquetes, projetNom: projets.nom })
    .from(enquetes)
    .leftJoin(projets, eq(projets.id, enquetes.projetId))
    .where(and(eq(enquetes.id, enqueteId), eq(enquetes.organizationId, organizationId), isNull(enquetes.deletedAt)));
  if (!ligne) return null;

  const reponses = await db
    .select({
      id: reponsesEnquete.id,
      canal: reponsesEnquete.canal,
      repondant: reponsesEnquete.repondant,
      enqueteur: users.fullName,
      priseLe: reponsesEnquete.priseLe,
      latitude: reponsesEnquete.latitudeMicro,
      valeurs: reponsesEnquete.valeurs,
    })
    .from(reponsesEnquete)
    .leftJoin(users, eq(users.id, reponsesEnquete.userId))
    .where(and(eq(reponsesEnquete.enqueteId, enqueteId), isNull(reponsesEnquete.deletedAt)))
    .orderBy(desc(reponsesEnquete.priseLe));

  const { enquete } = ligne;
  const valeurs = reponses.map((r) => r.valeurs);
  return {
    id: enquete.id,
    numero: enquete.numero,
    titre: enquete.titre,
    introduction: enquete.introduction,
    statut: enquete.statut,
    lienPublic: enquete.lienPublic,
    objectif: enquete.objectif,
    projetId: enquete.projetId,
    projetNom: ligne.projetNom,
    questions: enquete.questions,
    reponses: reponses.map((r) => ({
      id: r.id,
      canal: r.canal,
      repondant: r.repondant,
      enqueteur: r.enqueteur,
      priseLe: r.priseLe,
      aPosition: r.latitude !== null,
      valeurs: r.valeurs,
    })),
    syntheses: enquete.questions.map((question) => ({ question, synthese: synthetiser(question, valeurs) })),
    satisfaction: indiceSatisfaction(enquete.questions, valeurs),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Entreprise et enquête que nomme un lien public, s'il est intact et non
 * expiré. Le jeton porte les deux : c'est lui, pas l'adresse, qui fait foi.
 */
export function cibleDuLien(jeton: string): { organizationId: string; enqueteId: string } | null {
  const parties = verifierLien(jeton);
  if (!parties || parties.length !== 3 || parties[0] !== "enquete") return null;
  const [, organizationId, enqueteId] = parties;
  return UUID.test(organizationId) && UUID.test(enqueteId) ? { organizationId, enqueteId } : null;
}

/**
 * Ce que voit le répondant d'un lien public : le questionnaire, l'entreprise
 * qui le pose, et rien d'autre — ni réponses, ni projet.
 *
 * L'entreprise vient du jeton signé, comme pour une pièce envoyée au client :
 * la recherche reste filtrée sur `organization_id`, même hors session.
 */
export async function enquetePublique(organizationId: string, enqueteId: string): Promise<{
  entreprise: string;
  titre: string;
  introduction: string | null;
  questions: QuestionEnquete[];
  ouverte: boolean;
} | null> {
  const [l] = await db.execute<{
    entreprise: string;
    titre: string;
    introduction: string | null;
    questions: QuestionEnquete[];
    statut: StatutEnquete;
    lien_public: boolean;
  }>(sql`
    select o.name as entreprise, e.titre, e.introduction, e.questions, e.statut, e.lien_public
    from enquetes e join organizations o on o.id = e.organization_id
    where e.id = ${enqueteId} and e.organization_id = ${organizationId} and e.deleted_at is null
  `);
  if (!l) return null;
  return {
    entreprise: l.entreprise,
    titre: l.titre,
    introduction: l.introduction,
    questions: typeof l.questions === "string" ? (JSON.parse(l.questions) as QuestionEnquete[]) : l.questions,
    ouverte: l.statut === "ouverte" && l.lien_public,
  };
}
