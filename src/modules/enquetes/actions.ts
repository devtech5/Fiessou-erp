"use server";

import { revalidatePath } from "next/cache";

import { exigerEntreprise } from "@/lib/auth/dal";
import { refusDroit } from "@/lib/droits/garde";
import { signerLien, urlAbsolue } from "@/lib/liens-publics";

import { lireQuestions } from "./calcul";
import {
  basculerLienPour,
  changerStatutPour,
  creerEnquetePour,
  enregistrerReponsePour,
  modifierQuestionsPour,
} from "./creation";
import { cibleDuLien, enquetePublique } from "./requetes";

export type Resultat = { ok: true; message: string; id?: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Durée de validité d'un lien public : une campagne de satisfaction tient en trois mois. */
const JOURS_LIEN = 90;

function texte(donnees: FormData, champ: string): string | null {
  const v = donnees.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function lisible(erreur: unknown, contexte: string): string {
  const message = erreur instanceof Error ? erreur.message : "";
  if (message && !message.startsWith("Failed query") && message.length < 240) return message;
  console.error(contexte, erreur);
  return "L'opération n'a pas abouti. Réessayez.";
}

function revalider(enqueteId?: string) {
  revalidatePath("/enquetes", "layout");
  revalidatePath("/projets", "layout");
  if (enqueteId) revalidatePath(`/enquetes/${enqueteId}`);
}

export async function creerEnquete(donnees: FormData): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("enquetes.gerer");
  if (refus) return { ok: false, message: refus.erreur };

  const titre = texte(donnees, "titre");
  if (!titre || titre.length < 3) return { ok: false, message: "Donnez un titre à l'enquête." };
  const lecture = lireQuestions(String(donnees.get("questions") ?? ""));
  if ("erreur" in lecture) return { ok: false, message: lecture.erreur };
  const projetId = texte(donnees, "projetId");
  if (projetId && !UUID.test(projetId)) return { ok: false, message: "Projet inconnu." };
  const objectifSaisi = texte(donnees, "objectif");
  const objectif = objectifSaisi ? Number(objectifSaisi.replace(/\s/g, "")) : null;
  if (objectif !== null && (!Number.isInteger(objectif) || objectif < 1 || objectif > 1_000_000)) {
    return { ok: false, message: "Objectif : un nombre entier de réponses." };
  }

  try {
    const { id, numero } = await creerEnquetePour(
      session.organizationId,
      {
        titre,
        introduction: texte(donnees, "introduction")?.slice(0, 1000) ?? null,
        projetId,
        questions: lecture.questions,
        objectif,
      },
      session.userId,
    );
    revalider();
    return { ok: true, message: `Enquête ${numero} créée en brouillon.`, id };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "Enquête") };
  }
}

export async function modifierQuestions(enqueteId: string, questionsSaisies: string): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("enquetes.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(enqueteId)) return { ok: false, message: "Enquête inconnue." };
  const lecture = lireQuestions(String(questionsSaisies ?? ""));
  if ("erreur" in lecture) return { ok: false, message: lecture.erreur };
  try {
    await modifierQuestionsPour(session.organizationId, session.userId, enqueteId, lecture.questions);
    revalider(enqueteId);
    return { ok: true, message: "Questionnaire enregistré." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "Enquête") };
  }
}

export async function changerStatut(enqueteId: string, statut: "ouverte" | "close"): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("enquetes.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(enqueteId) || (statut !== "ouverte" && statut !== "close")) return { ok: false, message: "Enquête inconnue." };
  try {
    await changerStatutPour(session.organizationId, session.userId, enqueteId, statut);
    revalider(enqueteId);
    return { ok: true, message: statut === "ouverte" ? "Enquête ouverte aux réponses." : "Enquête close : les résultats sont figés." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "Enquête") };
  }
}

export async function basculerLien(enqueteId: string, actif: boolean): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("enquetes.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(enqueteId)) return { ok: false, message: "Enquête inconnue." };
  try {
    await basculerLienPour(session.organizationId, session.userId, enqueteId, actif);
    revalider(enqueteId);
    return { ok: true, message: actif ? "Lien public rétabli." : "Lien public coupé." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "Enquête") };
  }
}

/**
 * Lien public d'une enquête, signé, à envoyer par WhatsApp ou par e-mail.
 * Demandé au clic et jamais rendu dans le HTML : une page en cache ne doit
 * pas le distribuer.
 */
export async function lienPublic(enqueteId: string): Promise<Resultat & { url?: string }> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("enquetes.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(enqueteId) || !(await enquetePublique(session.organizationId, enqueteId))) {
    return { ok: false, message: "Enquête inconnue." };
  }
  const url = urlAbsolue(`/avis/${signerLien(["enquete", session.organizationId, enqueteId], JOURS_LIEN)}`);
  return { ok: true, message: `Lien valable ${JOURS_LIEN} jours.`, url };
}

export interface ReponseTerrain {
  id: string;
  enqueteId: string;
  valeurs: Record<string, unknown>;
  repondant?: string | null;
  latitudeMicro?: number | null;
  longitudeMicro?: number | null;
  priseLe?: string;
}

/** Réponse recueillie par un enquêteur. */
export async function enregistrerReponseTerrain(saisie: ReponseTerrain): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("enquetes.saisir");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(saisie.id) || !UUID.test(saisie.enqueteId)) return { ok: false, message: "Réponse invalide." };
  const lat = saisie.latitudeMicro;
  const lng = saisie.longitudeMicro;
  const position =
    Number.isInteger(lat) && Number.isInteger(lng) ? { latitudeMicro: lat as number, longitudeMicro: lng as number } : {};
  const prise = saisie.priseLe ? new Date(saisie.priseLe) : new Date();
  // Une heure d'appareil dans le futur ne passe pas : on garde l'heure de réception.
  const priseLe = Number.isNaN(prise.getTime()) || prise.getTime() > Date.now() + 5 * 60_000 ? new Date() : prise;

  try {
    const { deja } = await enregistrerReponsePour(
      session.organizationId,
      {
        id: saisie.id,
        enqueteId: saisie.enqueteId,
        canal: "terrain",
        saisie: saisie.valeurs ?? {},
        repondant: typeof saisie.repondant === "string" ? saisie.repondant : null,
        ...position,
        priseLe,
      },
      session.userId,
    );
    revalider(saisie.enqueteId);
    return { ok: true, message: deja ? "Réponse déjà reçue." : "Réponse enregistrée. Merci !" };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "Réponse d'enquête") };
  }
}

/**
 * Réponse par le lien public, sans compte.
 *
 * Le jeton seul ouvre l'enquête qu'il nomme ; un champ piège, invisible pour
 * un humain, écarte les robots qui remplissent tout ce qu'ils trouvent.
 */
export async function repondreEnLigne(jeton: string, id: string, valeurs: Record<string, unknown>, piege: string): Promise<Resultat> {
  const cible = cibleDuLien(String(jeton ?? ""));
  if (!cible) return { ok: false, message: "Ce lien n'est plus valable." };
  if (!UUID.test(String(id ?? ""))) return { ok: false, message: "Réponse invalide." };
  // Un robot remplit le champ piège ; on lui dit merci sans rien enregistrer.
  if (piege) return { ok: true, message: "Merci pour votre réponse." };

  try {
    await enregistrerReponsePour(cible.organizationId, { id, enqueteId: cible.enqueteId, canal: "lien", saisie: valeurs ?? {} }, null);
    return { ok: true, message: "Merci pour votre réponse." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "Réponse en ligne") };
  }
}
