import { divideMoney } from "@/lib/money";

/**
 * Enquêtes et satisfaction : la forme d'un questionnaire, la validation d'une
 * réponse et la synthèse des résultats. Sans base : ce qui se décide ici se
 * teste.
 *
 * Toute moyenne reste un ENTIER : une note sur 5 se garde en centièmes
 * (4,27 → 427), un taux en points de base. Pas de flottant, même pour une
 * satisfaction.
 */

export type TypeQuestion = "note" | "nps" | "choix" | "oui_non" | "texte" | "nombre";

export interface QuestionEnquete {
  /** Clé stable : renommer le libellé ne perd pas les réponses. */
  cle: string;
  libelle: string;
  type: TypeQuestion;
  obligatoire: boolean;
  /** Valeurs proposées, pour une question `choix`. */
  options?: string[];
}

export type Valeur = string | number | boolean;
export type Valeurs = Record<string, Valeur>;

export const LIBELLE_TYPE: Record<TypeQuestion, string> = {
  note: "Note de 1 à 5",
  nps: "Recommandation de 0 à 10",
  choix: "Choix",
  oui_non: "Oui / non",
  texte: "Texte libre",
  nombre: "Nombre",
};

/** Mots acceptés dans la saisie d'un questionnaire, en plus des clés. */
const ALIAS: Record<string, TypeQuestion> = {
  note: "note",
  etoiles: "note",
  étoiles: "note",
  satisfaction: "note",
  nps: "nps",
  recommandation: "nps",
  choix: "choix",
  liste: "choix",
  oui_non: "oui_non",
  "oui/non": "oui_non",
  ouinon: "oui_non",
  texte: "texte",
  commentaire: "texte",
  nombre: "nombre",
};

function cleDe(libelle: string, prises: Set<string>): string {
  const base =
    libelle
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "question";
  let cle = base;
  for (let n = 2; prises.has(cle); n++) cle = `${base}_${n}`;
  prises.add(cle);
  return cle;
}

/**
 * Lit un questionnaire écrit à raison d'une question par ligne :
 *
 *     Accueil du personnel | note | *
 *     Recommanderiez-vous notre service ? | nps
 *     Comment nous avez-vous connus ? | choix | | Radio, Ami, WhatsApp
 *
 * libellé | type | « * » si obligatoire | options séparées par des virgules.
 * Une ligne mal formée est refusée avec son numéro : mieux vaut corriger le
 * questionnaire que d'envoyer sur le terrain une question qui ne veut rien dire.
 */
export function lireQuestions(texte: string): { questions: QuestionEnquete[] } | { erreur: string } {
  const prises = new Set<string>();
  const questions: QuestionEnquete[] = [];
  const lignes = texte.split(/\r?\n/);

  for (const [index, brute] of lignes.entries()) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const [libelle = "", typeSaisi = "texte", requis = "", options = ""] = ligne.split("|").map((p) => p.trim());
    const numero = index + 1;
    if (libelle.length < 2) return { erreur: `Ligne ${numero} : le libellé manque.` };
    if (libelle.length > 200) return { erreur: `Ligne ${numero} : libellé trop long.` };
    const type = ALIAS[typeSaisi.toLowerCase() || "texte"];
    if (!type) return { erreur: `Ligne ${numero} : type « ${typeSaisi} » inconnu.` };

    const question: QuestionEnquete = { cle: cleDe(libelle, prises), libelle, type, obligatoire: requis === "*" };
    if (type === "choix") {
      const liste = [...new Set(options.split(",").map((o) => o.trim()).filter(Boolean))];
      if (liste.length < 2) return { erreur: `Ligne ${numero} : un choix propose au moins deux options.` };
      question.options = liste;
    }
    questions.push(question);
  }

  if (questions.length === 0) return { erreur: "Le questionnaire n'a aucune question." };
  if (questions.length > 40) return { erreur: "Quarante questions au plus : au-delà, personne ne répond jusqu'au bout." };
  return { questions };
}

/** Réécrit un questionnaire dans le format de saisie, pour le modifier. */
export function ecrireQuestions(questions: readonly QuestionEnquete[]): string {
  return questions
    .map((q) => [q.libelle, q.type, q.obligatoire ? "*" : "", q.options?.join(", ") ?? ""].join(" | ").replace(/( \| )+$/, ""))
    .join("\n");
}

/**
 * Valide une réponse contre son questionnaire et la ramène à des valeurs
 * propres : une note en entier, un oui/non en booléen, un choix parmi les
 * options. Les clés inconnues sont écartées — un formulaire public peut être
 * trafiqué.
 */
export function validerReponse(
  questions: readonly QuestionEnquete[],
  saisie: Record<string, unknown>,
): { valeurs: Valeurs } | { erreur: string } {
  const valeurs: Valeurs = {};
  for (const q of questions) {
    const brute = saisie[q.cle];
    const vide = brute === undefined || brute === null || (typeof brute === "string" && brute.trim() === "");
    if (vide) {
      if (q.obligatoire) return { erreur: `« ${q.libelle} » attend une réponse.` };
      continue;
    }

    switch (q.type) {
      case "note":
      case "nps": {
        const n = Number(brute);
        const [min, max] = q.type === "note" ? [1, 5] : [0, 10];
        if (!Number.isInteger(n) || n < min || n > max) return { erreur: `« ${q.libelle} » : une note de ${min} à ${max}.` };
        valeurs[q.cle] = n;
        break;
      }
      case "nombre": {
        const n = Number(String(brute).replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(n) || Math.abs(n) > 1e12) return { erreur: `« ${q.libelle} » : un nombre.` };
        valeurs[q.cle] = n;
        break;
      }
      case "oui_non": {
        const v = typeof brute === "boolean" ? brute : ["oui", "true", "1", "on"].includes(String(brute).toLowerCase()) ? true : ["non", "false", "0"].includes(String(brute).toLowerCase()) ? false : null;
        if (v === null) return { erreur: `« ${q.libelle} » : oui ou non.` };
        valeurs[q.cle] = v;
        break;
      }
      case "choix": {
        const v = String(brute);
        if (!q.options?.includes(v)) return { erreur: `« ${q.libelle} » : choisissez parmi les options proposées.` };
        valeurs[q.cle] = v;
        break;
      }
      case "texte": {
        const v = String(brute).trim();
        if (v.length > 2000) return { erreur: `« ${q.libelle} » : 2 000 caractères au plus.` };
        valeurs[q.cle] = v;
        break;
      }
    }
  }
  return { valeurs };
}

// ------------------------------------------------------------------ synthèse

export type SyntheseQuestion =
  | { type: "note"; reponses: number; moyenneCentiemes: number | null; repartition: number[] }
  | { type: "nps"; reponses: number; score: number | null; promoteurs: number; passifs: number; detracteurs: number }
  | { type: "choix"; reponses: number; comptes: { option: string; nombre: number }[] }
  | { type: "oui_non"; reponses: number; oui: number; non: number }
  | { type: "nombre"; reponses: number; moyenneCentiemes: number | null }
  | { type: "texte"; reponses: number; derniers: string[] };

/**
 * Résume les réponses d'une question.
 *
 *   · note — moyenne en centièmes et répartition de 1 à 5 ;
 *   · nps  — Net Promoter Score : part des 9-10 moins part des 0-6, de −100
 *            à +100, arrondi à l'entier ;
 *   · choix, oui/non — comptes ;
 *   · texte — les derniers commentaires, les plus récents d'abord.
 *
 * `reponses` est ordonné du plus récent au plus ancien.
 */
export function synthetiser(question: QuestionEnquete, reponses: readonly Valeurs[]): SyntheseQuestion {
  const valeurs = reponses.map((r) => r[question.cle]).filter((v) => v !== undefined);

  switch (question.type) {
    case "note": {
      const notes = valeurs.filter((v): v is number => typeof v === "number");
      const repartition = [1, 2, 3, 4, 5].map((n) => notes.filter((x) => x === n).length);
      const somme = notes.reduce((s, n) => s + n, 0);
      return { type: "note", reponses: notes.length, moyenneCentiemes: notes.length ? divideMoney(somme * 100, notes.length) : null, repartition };
    }
    case "nps": {
      const notes = valeurs.filter((v): v is number => typeof v === "number");
      const promoteurs = notes.filter((n) => n >= 9).length;
      const detracteurs = notes.filter((n) => n <= 6).length;
      return {
        type: "nps",
        reponses: notes.length,
        score: notes.length ? divideMoney((promoteurs - detracteurs) * 100, notes.length) : null,
        promoteurs,
        passifs: notes.length - promoteurs - detracteurs,
        detracteurs,
      };
    }
    case "choix": {
      const comptes = (question.options ?? []).map((option) => ({ option, nombre: valeurs.filter((v) => v === option).length }));
      return { type: "choix", reponses: valeurs.length, comptes };
    }
    case "oui_non": {
      const oui = valeurs.filter((v) => v === true).length;
      const non = valeurs.filter((v) => v === false).length;
      return { type: "oui_non", reponses: oui + non, oui, non };
    }
    case "nombre": {
      const nombres = valeurs.filter((v): v is number => typeof v === "number");
      const somme = nombres.reduce((s, n) => s + Math.round(n * 100), 0);
      return { type: "nombre", reponses: nombres.length, moyenneCentiemes: nombres.length ? divideMoney(somme, nombres.length) : null };
    }
    case "texte": {
      const textes = valeurs.filter((v): v is string => typeof v === "string" && v.length > 0);
      return { type: "texte", reponses: textes.length, derniers: textes.slice(0, 20) };
    }
  }
}

/**
 * Indice de satisfaction d'une enquête : la moyenne de ses questions notées,
 * ramenée sur 100. Nul quand l'enquête n'a pas de question notée ou pas de
 * réponse — ce n'est pas un zéro.
 */
export function indiceSatisfaction(questions: readonly QuestionEnquete[], reponses: readonly Valeurs[]): number | null {
  const notes = questions
    .filter((q) => q.type === "note")
    .flatMap((q) => reponses.map((r) => r[q.cle]).filter((v): v is number => typeof v === "number"));
  if (notes.length === 0) return null;
  // Une note de 1 à 5 se ramène sur 100 : 1 → 0, 5 → 100.
  const somme = notes.reduce((s, n) => s + (n - 1) * 25, 0);
  return divideMoney(somme, notes.length);
}

/** « 4,27 » pour 427 centièmes. */
export function formaterCentiemes(centiemes: number): string {
  return (centiemes / 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
