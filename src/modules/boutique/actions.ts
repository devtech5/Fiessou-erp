"use server";

import { revalidatePath } from "next/cache";

import { exigerEntreprise } from "@/lib/auth/dal";
import { refusDroit } from "@/lib/droits/garde";

import { installerCatalogueDepartPour } from "./creation";

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

export async function installerCatalogueDepart(): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("stock.article.gerer");
  if (refus) return { ok: false, message: refus.erreur };

  try {
    const { creees } = await installerCatalogueDepartPour(session.organizationId, session.userId);
    revalidatePath("/boutique");
    revalidatePath("/stock", "layout");
    return {
      ok: true,
      message: creees === 0 ? "Les familles du commerce sont déjà en place." : `${creees} famille${creees > 1 ? "s" : ""} d'articles installée${creees > 1 ? "s" : ""}.`,
    };
  } catch (erreur) {
    console.error("Catalogue de départ", erreur);
    return { ok: false, message: "L'installation n'a pas abouti. Réessayez." };
  }
}
