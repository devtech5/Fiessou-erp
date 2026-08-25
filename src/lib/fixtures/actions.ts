"use server";

import { revalidatePath } from "next/cache";

import { exigerEntreprise } from "@/lib/auth/dal";
import { installerJeuDemonstration } from "./installer";

export interface EtatInstallation {
  message?: string;
  erreur?: string;
}

/**
 * Verse le jeu de démonstration dans l'entreprise active.
 *
 * À réserver aux bases sans données réelles, comme le mode démonstration
 * lui-même : l'action crée des clients et des fournisseurs qui n'existent pas.
 * Elle est idempotente — un second appel ne duplique rien.
 */
export async function installerDemonstration(): Promise<EtatInstallation> {
  const session = await exigerEntreprise();

  const resultat = await installerJeuDemonstration(
    session.organizationId,
    session.userId,
  );

  // Le jeu touche le catalogue, le fichier tiers et le tableau de bord :
  // revalider le layout plutôt que d'énumérer les routes concernées.
  revalidatePath("/", "layout");

  if (resultat.deja) {
    return { message: "Le jeu de démonstration est déjà installé." };
  }

  return {
    message:
      `${resultat.articles} articles, ${resultat.tiers} tiers et ` +
      `${resultat.codes} codes-barres installés.`,
  };
}
