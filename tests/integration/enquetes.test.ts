import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { newId } from "@/lib/ids";
import { lireQuestions } from "@/modules/enquetes/calcul";
import { changerStatutPour, creerEnquetePour, enregistrerReponsePour, modifierQuestionsPour, basculerLienPour } from "@/modules/enquetes/creation";
import { cibleDuLien, enquetePublique, ficheEnquete, listerEnquetes } from "@/modules/enquetes/requetes";
import { signerLien } from "@/lib/liens-publics";

import { ouvrirBaseDeTest, semerEntreprise } from "./base";

let db: typeof Db;
let fermer: () => Promise<void>;
let org: string;
let autre: string;
let user: string;

beforeAll(async () => {
  ({ db, fermer } = await ouvrirBaseDeTest());
  ({ organizationId: org, userId: user } = await semerEntreprise(db));
  ({ organizationId: autre } = await semerEntreprise(db, "Autre entreprise"));
});
afterAll(async () => fermer());

function questions(texte: string) {
  const r = lireQuestions(texte);
  if ("erreur" in r) throw new Error(r.erreur);
  return r.questions;
}

describe("enquêtes en base", () => {
  it("du brouillon aux résultats, terrain et lien public", async () => {
    const q = questions("Accueil | note | *\nRecommandation | nps\nCommentaire | texte");
    const { id, numero } = await creerEnquetePour(org, { titre: "Satisfaction chantier", questions: q, objectif: 50 }, user, new Date("2026-10-11T09:00:00Z"));
    expect(numero).toBe("ENQ-2026-001");

    // Un brouillon ne reçoit rien.
    await expect(enregistrerReponsePour(org, { id: newId(), enqueteId: id, canal: "terrain", saisie: { accueil: 5 } }, user)).rejects.toThrow(/pas ouverte/);

    // Tant qu'il n'y a pas de réponse, le questionnaire se corrige.
    await modifierQuestionsPour(org, user, id, questions("Accueil | note | *\nRecommandation | nps\nCommentaire | texte\nRevenir ? | oui_non"));
    await changerStatutPour(org, user, id, "ouverte");

    const terrain = newId();
    await enregistrerReponsePour(org, { id: terrain, enqueteId: id, canal: "terrain", saisie: { accueil: 5, recommandation: 10, revenir: "oui" }, latitudeMicro: 5_345_317, longitudeMicro: -4_024_429 }, user);
    // Renvoi depuis un réseau instable : pas de doublon.
    expect(await enregistrerReponsePour(org, { id: terrain, enqueteId: id, canal: "terrain", saisie: { accueil: 5 } }, user)).toEqual({ deja: true });
    await enregistrerReponsePour(org, { id: newId(), enqueteId: id, canal: "lien", saisie: { accueil: "2", recommandation: "4", commentaire: "Trop de retard" } }, null);

    // Une réponse invalide est refusée, même par le lien public.
    await expect(enregistrerReponsePour(org, { id: newId(), enqueteId: id, canal: "lien", saisie: { accueil: 9 } }, null)).rejects.toThrow(/1 à 5/);
    // Une autre entreprise ne peut pas répondre à cette enquête.
    await expect(enregistrerReponsePour(autre, { id: newId(), enqueteId: id, canal: "lien", saisie: { accueil: 3 } }, null)).rejects.toThrow(/introuvable/);

    // Questions figées dès la première réponse.
    await expect(modifierQuestionsPour(org, user, id, q)).rejects.toThrow(/déjà des réponses/);

    const fiche = await ficheEnquete(org, id);
    expect(fiche?.reponses).toHaveLength(2);
    expect(fiche?.satisfaction).toBe(63);
    expect(fiche?.syntheses.find((s) => s.question.cle === "recommandation")?.synthese).toMatchObject({ score: 0, promoteurs: 1, detracteurs: 1 });

    const [resume] = await listerEnquetes(org);
    expect(resume).toMatchObject({ numero: "ENQ-2026-001", reponses: 2, reponsesTerrain: 1, satisfaction: 63 });
    expect(await listerEnquetes(autre)).toEqual([]);

    // Le lien coupé refuse le public, pas le terrain.
    await basculerLienPour(org, user, id, false);
    expect((await enquetePublique(org, id))?.ouverte).toBe(false);
    await expect(enregistrerReponsePour(org, { id: newId(), enqueteId: id, canal: "lien", saisie: { accueil: 3 } }, null)).rejects.toThrow(/en ligne/);
    await enregistrerReponsePour(org, { id: newId(), enqueteId: id, canal: "terrain", saisie: { accueil: 3 } }, user);
    // Le lien d'une enquête ne s'ouvre pas sous une autre entreprise.
    expect(await enquetePublique(autre, id)).toBeNull();
    expect(cibleDuLien(signerLien(["enquete", org, id], 1))).toEqual({ organizationId: org, enqueteId: id });
    expect(cibleDuLien(signerLien(["piece", org, id], 1))).toBeNull();
    expect(cibleDuLien(`${signerLien(["enquete", org, id], 1)}x`)).toBeNull();

    await changerStatutPour(org, user, id, "close");
    await expect(enregistrerReponsePour(org, { id: newId(), enqueteId: id, canal: "terrain", saisie: { accueil: 4 } }, user)).rejects.toThrow(/pas ouverte/);
  });
});
