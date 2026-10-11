import { describe, expect, it } from "vitest";

import {
  ecrireQuestions,
  formaterCentiemes,
  indiceSatisfaction,
  lireQuestions,
  synthetiser,
  validerReponse,
  type QuestionEnquete,
} from "@/modules/enquetes/calcul";

const SAISIE = [
  "Êtes-vous satisfait de l'accueil ? | note | *",
  "Recommanderiez-vous notre entreprise ? | nps",
  "Comment nous avez-vous connus ? | choix | | Ami, WhatsApp, Radio",
  "Livré à temps ? | oui/non",
  "Votre commentaire",
].join("\n");

function questions(): QuestionEnquete[] {
  const r = lireQuestions(SAISIE);
  if ("erreur" in r) throw new Error(r.erreur);
  return r.questions;
}

describe("questionnaire", () => {
  it("lit une question par ligne, avec type, obligation et options", () => {
    const q = questions();
    expect(q.map((x) => [x.cle, x.type, x.obligatoire])).toEqual([
      ["etes_vous_satisfait_de_l_accueil", "note", true],
      ["recommanderiez_vous_notre_entreprise", "nps", false],
      ["comment_nous_avez_vous_connus", "choix", false],
      ["livre_a_temps", "oui_non", false],
      ["votre_commentaire", "texte", false],
    ]);
    expect(q[2].options).toEqual(["Ami", "WhatsApp", "Radio"]);
  });

  it("refuse une ligne mal formée, avec son numéro", () => {
    expect(lireQuestions("Bonne question ? | couleur")).toEqual({ erreur: "Ligne 1 : type « couleur » inconnu." });
    expect(lireQuestions("Ok | note\nQuel choix ? | choix | | Seul")).toEqual({ erreur: "Ligne 2 : un choix propose au moins deux options." });
    expect(lireQuestions("\n  \n")).toEqual({ erreur: "Le questionnaire n'a aucune question." });
  });

  it("donne une clé distincte à deux libellés identiques", () => {
    const r = lireQuestions("Note | note\nNote | note");
    expect("questions" in r && r.questions.map((q) => q.cle)).toEqual(["note", "note_2"]);
  });

  it("se réécrit dans le format de saisie", () => {
    const relu = lireQuestions(ecrireQuestions(questions()));
    expect("questions" in relu && relu.questions).toEqual(questions());
  });
});

describe("réponse", () => {
  it("exige les questions obligatoires et ramène les valeurs à leur type", () => {
    const q = questions();
    expect(validerReponse(q, {})).toEqual({ erreur: "« Êtes-vous satisfait de l'accueil ? » attend une réponse." });
    expect(
      validerReponse(q, {
        etes_vous_satisfait_de_l_accueil: "4",
        recommanderiez_vous_notre_entreprise: 10,
        comment_nous_avez_vous_connus: "Radio",
        livre_a_temps: "non",
        votre_commentaire: "  Très bien  ",
        cle_inventee: "piratage",
      }),
    ).toEqual({
      valeurs: {
        etes_vous_satisfait_de_l_accueil: 4,
        recommanderiez_vous_notre_entreprise: 10,
        comment_nous_avez_vous_connus: "Radio",
        livre_a_temps: false,
        votre_commentaire: "Très bien",
      },
    });
  });

  it("refuse une note hors bornes et un choix inventé", () => {
    const q = questions();
    expect(validerReponse(q, { etes_vous_satisfait_de_l_accueil: 6 })).toHaveProperty("erreur");
    expect(validerReponse(q, { etes_vous_satisfait_de_l_accueil: 3.5 })).toHaveProperty("erreur");
    expect(validerReponse(q, { etes_vous_satisfait_de_l_accueil: 3, comment_nous_avez_vous_connus: "Télé" })).toHaveProperty("erreur");
  });
});

describe("synthèse", () => {
  const [note, nps, choix, ouiNon, texte] = questions();
  const reponses = [
    { [note.cle]: 5, [nps.cle]: 10, [choix.cle]: "Ami", [ouiNon.cle]: true, [texte.cle]: "Parfait" },
    { [note.cle]: 4, [nps.cle]: 9, [choix.cle]: "Ami", [ouiNon.cle]: true },
    { [note.cle]: 2, [nps.cle]: 3, [choix.cle]: "Radio", [ouiNon.cle]: false, [texte.cle]: "Trop long" },
  ];

  it("moyenne les notes en centièmes, sans flottant", () => {
    expect(synthetiser(note, reponses)).toEqual({ type: "note", reponses: 3, moyenneCentiemes: 367, repartition: [0, 1, 0, 1, 1] });
    expect(formaterCentiemes(367)).toBe("3,67");
  });

  it("calcule le score de recommandation : promoteurs moins détracteurs", () => {
    expect(synthetiser(nps, reponses)).toEqual({ type: "nps", reponses: 3, score: 33, promoteurs: 2, passifs: 0, detracteurs: 1 });
  });

  it("compte les choix et les oui/non, garde les commentaires récents d'abord", () => {
    expect(synthetiser(choix, reponses)).toMatchObject({ comptes: [{ option: "Ami", nombre: 2 }, { option: "WhatsApp", nombre: 0 }, { option: "Radio", nombre: 1 }] });
    expect(synthetiser(ouiNon, reponses)).toEqual({ type: "oui_non", reponses: 3, oui: 2, non: 1 });
    expect(synthetiser(texte, reponses)).toEqual({ type: "texte", reponses: 2, derniers: ["Parfait", "Trop long"] });
  });

  it("ramène la satisfaction sur 100, et ne l'invente pas sans note", () => {
    // Notes 5, 4, 2 → 100, 75, 25 → 67.
    expect(indiceSatisfaction(questions(), reponses)).toBe(67);
    expect(indiceSatisfaction(questions(), [])).toBeNull();
    expect(indiceSatisfaction([texte], reponses)).toBeNull();
  });
});
