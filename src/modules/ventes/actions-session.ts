"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import {
  cloturerSessionDans,
  ouvrirSessionDans,
  type ResultatCloture,
} from "./session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un entier de francs saisi au clavier, espaces de milliers admis. */
const montant = z
  .string()
  .trim()
  .transform((valeur) => Number(valeur.replace(/[\s ]/g, "") || "0"))
  .pipe(z.number().int().min(0));

export interface EtatSession {
  erreur?: string;
  message?: string;
}

const schemaOuverture = z.object({
  caisseId: z.string().regex(UUID, "Poste de caisse introuvable."),
  fondInitial: montant,
});

/**
 * Ouvre le tiroir pour la journée.
 *
 * Le fond initial est de la monnaie déposée pour rendre la monnaie, pas une
 * recette : aucune écriture n'est passée, l'argent était déjà dans l'entreprise
 * hier soir.
 */
export async function ouvrirSessionCaisse(
  _precedent: EtatSession,
  donnees: FormData,
): Promise<EtatSession> {
  const session = await exigerEntreprise();

  const analyse = schemaOuverture.safeParse({
    caisseId: donnees.get("caisseId"),
    fondInitial: String(donnees.get("fondInitial") ?? "0"),
  });

  if (!analyse.success) return { erreur: analyse.error.issues[0].message };

  try {
    await db.transaction((tx) =>
      ouvrirSessionDans(
        tx,
        session.organizationId,
        { caisseId: analyse.data.caisseId, caissier: session.nom, fondInitial: analyse.data.fondInitial },
        session.userId,
      ),
    );

    revalidatePath("/caisse");
    revalidatePath("/commercial/ventes");
    return { message: "Caisse ouverte." };
  } catch (erreur) {
    // L'index unique partiel a fait son travail : un tiroir est déjà ouvert.
    if (erreur instanceof Error && erreur.message.includes("sessions_caisse_ouverte_unique")) {
      return {
        erreur:
          "Une session est déjà ouverte sur ce poste. Clôturez-la avant d'en ouvrir une autre.",
      };
    }
    throw erreur;
  }
}

export interface EtatCloture {
  erreur?: string;
  resultat?: ResultatCloture;
}

const schemaCloture = z.object({
  sessionId: z.string().regex(UUID),
  especes: montant,
  mobile_money: montant,
  carte: montant,
  banque: montant,
  motif: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Clôture : le caissier annonce ce qu'il a compté, l'écart se constate.
 *
 * Le comptage est saisi par MOYEN. Un total unique additionnerait ce qui se
 * compte à la main et ce qui se lit sur un relevé — et un vol d'espèces s'y
 * compenserait avec une commission mal saisie, laissant une caisse
 * apparemment juste.
 */
export async function cloturerSessionCaisse(
  _precedent: EtatCloture,
  donnees: FormData,
): Promise<EtatCloture> {
  const session = await exigerEntreprise();

  const texte = (champ: string) => {
    const valeur = donnees.get(champ);
    if (typeof valeur !== "string") return undefined;
    return valeur.trim() === "" ? undefined : valeur.trim();
  };

  const analyse = schemaCloture.safeParse({
    sessionId: donnees.get("sessionId"),
    especes: String(donnees.get("especes") ?? "0"),
    mobile_money: String(donnees.get("mobile_money") ?? "0"),
    carte: String(donnees.get("carte") ?? "0"),
    banque: String(donnees.get("banque") ?? "0"),
    motif: texte("motif"),
    notes: texte("notes"),
  });

  if (!analyse.success) return { erreur: analyse.error.issues[0].message };

  const valeurs = analyse.data;

  try {
    const resultat = await db.transaction((tx) =>
      cloturerSessionDans(
        tx,
        session.organizationId,
        valeurs.sessionId,
        [
          { moyen: "especes", compte: valeurs.especes },
          { moyen: "mobile_money", compte: valeurs.mobile_money },
          { moyen: "carte", compte: valeurs.carte },
          { moyen: "banque", compte: valeurs.banque },
        ],
        {
          userId: session.userId,
          motif: valeurs.motif ?? null,
          notes: valeurs.notes ?? null,
        },
      ),
    );

    revalidatePath("/caisse");
    revalidatePath("/commercial/ventes");
    revalidatePath("/comptabilite");
    return { resultat };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);

    if (message.includes("sans motif") || message.includes("Aucune session")) {
      return { erreur: message };
    }

    console.error("Clôture refusée", erreur);
    return { erreur: "La clôture a échoué. Le tiroir reste ouvert." };
  }
}
