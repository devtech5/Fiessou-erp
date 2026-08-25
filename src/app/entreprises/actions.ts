"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { exigerSession } from "@/lib/auth/dal";
import { creerEntreprisePour } from "@/lib/auth/creation-entreprise";
import { choisirEntreprise } from "@/lib/auth/session";

export interface EtatCreation {
  erreur?: string;
}

const schema = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom de l'entreprise."),
  pays: z.string().length(2),
});

/**
 * Crée une entreprise supplémentaire et bascule dessus.
 *
 * Basculer immédiatement est délibéré : quelqu'un qui vient de créer une
 * entreprise veut y travailler. Le laisser sur la précédente l'obligerait à
 * comprendre qu'il doit encore la sélectionner, et la première chose qu'il
 * saisirait partirait dans la mauvaise.
 */
export async function creerEntreprise(
  _precedent: EtatCreation,
  donnees: FormData,
): Promise<EtatCreation> {
  const session = await exigerSession();

  const analyse = schema.safeParse({
    nom: donnees.get("nom"),
    pays: donnees.get("pays"),
  });

  if (!analyse.success) {
    return { erreur: analyse.error.issues[0].message };
  }

  const organizationId = await creerEntreprisePour(session.userId, {
    nom: analyse.data.nom,
    pays: analyse.data.pays,
  });

  await choisirEntreprise(session.sessionId, organizationId);
  redirect("/");
}

/** Bascule sur une entreprise depuis l'écran de choix. */
export async function activerEntreprise(formulaire: FormData): Promise<void> {
  const session = await exigerSession();
  const organizationId = String(formulaire.get("organizationId") ?? "");

  // Le rattachement est revérifié : l'identifiant vient du client.
  const { entreprisesAccessibles } = await import("@/lib/auth/entreprises");
  const accessibles = await entreprisesAccessibles(session.userId);

  if (!accessibles.some((e) => e.id === organizationId)) {
    throw new Error("Entreprise inaccessible.");
  }

  await choisirEntreprise(session.sessionId, organizationId);
  redirect("/");
}
