"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { env } from "@/env";
import { newId } from "@/lib/ids";
import { creerEntreprisePour } from "./creation-entreprise";
import { emettreCode, normaliserTelephone, verifierCode } from "./otp";
import {
  choisirEntreprise,
  fermerSession,
  lireSession,
  ouvrirSession,
} from "./session";

export interface EtatConnexion {
  etape: "telephone" | "code" | "inscription";
  telephone?: string;
  erreur?: string;
  message?: string;
  /** Code affiché à l'écran, en mode démonstration uniquement. */
  codeDemo?: string;
}

/**
 * Étape 1 — le numéro.
 *
 * La réponse ne dit jamais si le numéro est connu. Un formulaire qui répond
 * « ce compte n'existe pas » offre à qui le veut la liste de vos clients : il
 * suffit d'essayer des numéros. Connu ou non, un code part et l'écran passe à
 * l'étape suivante.
 */
export async function demanderCode(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const saisie = String(donnees.get("telephone") ?? "");
  const telephone = normaliserTelephone(saisie);

  if (!telephone) {
    return {
      etape: "telephone",
      erreur: "Numéro invalide. Exemple : 07 08 12 34 56",
    };
  }

  const envoi = await emettreCode(telephone, "connexion");

  if (!envoi.ok) {
    // Deux échecs, deux conduites à tenir. « Patientez » invite à attendre ;
    // sur un envoi qui n'est pas parti, attendre ne sert à rien et la personne
    // resterait devant un écran de saisie pour un code qui n'arrivera jamais.
    // On la renvoie donc à l'étape du numéro, où le bouton est réarmé.
    if (envoi.raison === "envoi_impossible") {
      return {
        etape: "telephone",
        telephone,
        erreur:
          "Le code n'a pas pu être envoyé. Vérifiez le numéro et réessayez ; si cela se répète, prévenez le support.",
      };
    }

    return {
      etape: "code",
      telephone,
      erreur: "Un code vient d'être envoyé. Patientez une minute avant d'en redemander un.",
    };
  }

  return {
    etape: "code",
    telephone,
    codeDemo: envoi.codeAffiche,
    message:
      env.OTP_CHANNEL === "console"
        ? "Code écrit dans les journaux du serveur (mode développement)."
        : env.OTP_CHANNEL === "demo"
          ? undefined
          : `Code envoyé au ${telephone}.`,
  };
}

/**
 * Étape 2 — le code.
 *
 * Un numéro inconnu qui présente un code valide n'est pas une erreur : c'est
 * une inscription. On bascule alors sur l'étape d'identité plutôt que de
 * refuser quelqu'un qui vient de prouver qu'il détient ce numéro.
 */
export async function verifierCodeConnexion(
  precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const telephone = String(donnees.get("telephone") ?? precedent.telephone ?? "");
  const code = String(donnees.get("code") ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return { etape: "code", telephone, erreur: "Le code comporte six chiffres." };
  }

  const resultat = await verifierCode(telephone, "connexion", code);

  if (!resultat.ok) {
    const messages = {
      invalide: "Code incorrect.",
      expire: "Ce code a expiré. Demandez-en un nouveau.",
      trop_de_tentatives: "Trop de tentatives. Demandez un nouveau code.",
    } as const;
    return { etape: "code", telephone, erreur: messages[resultat.raison] };
  }

  const existants = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, telephone))
    .limit(1);

  if (existants.length === 0) {
    return { etape: "inscription", telephone };
  }

  await ouvrirSessionAvecContexte(existants[0].id);
  redirect("/");
}

const schemaInscription = z.object({
  nom: z.string().trim().min(2, "Indiquez votre nom."),
  entreprise: z.string().trim().min(2, "Indiquez le nom de votre entreprise."),
});

/**
 * Étape 3 — première connexion.
 *
 * Crée l'utilisateur, son entreprise, le rôle de propriétaire et le
 * rattachement, en une seule transaction. Un compte sans entreprise, ou une
 * entreprise sans propriétaire, laisserait quelqu'un connecté devant une
 * application vide sans moyen d'en sortir.
 */
export async function finaliserInscription(
  precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const telephone = String(donnees.get("telephone") ?? precedent.telephone ?? "");

  const analyse = schemaInscription.safeParse({
    nom: donnees.get("nom"),
    entreprise: donnees.get("entreprise"),
  });

  if (!analyse.success) {
    return {
      etape: "inscription",
      telephone,
      erreur: analyse.error.issues[0].message,
    };
  }

  const { nom, entreprise } = analyse.data;
  const userId = newId();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      phone: telephone,
      fullName: nom,
      phoneVerifiedAt: new Date(),
    });

    // L'entreprise, ses rôles et le rattachement du propriétaire naissent
    // ensemble, dans la même transaction que l'utilisateur : celui qui
    // s'inscrit doit se retrouver administrateur de sa boutique, ou pas
    // d'inscription du tout.
    await creerEntreprisePour(
      userId,
      { nom: entreprise, pays: env.DEFAULT_COUNTRY },
      tx,
    );
  });

  await ouvrirSessionAvecContexte(userId);
  redirect("/");
}

export async function seDeconnecter(): Promise<void> {
  await fermerSession();
  redirect("/connexion");
}

/**
 * Bascule l'entreprise active de la session.
 *
 * Le rattachement est revérifié ici et pas seulement au moment d'afficher le
 * sélecteur : l'identifiant vient du client, et rien n'empêche d'en poster un
 * autre. Sans ce contrôle, il suffirait de deviner un identifiant pour entrer
 * dans les données d'une entreprise voisine.
 */
export async function basculerEntreprise(organizationId: string): Promise<void> {
  const active = await lireSession();
  if (!active) redirect("/connexion");

  const autorises = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, active.userId),
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, "actif"),
      ),
    )
    .limit(1);

  if (autorises.length === 0) {
    throw new Error("Entreprise inaccessible.");
  }

  await choisirEntreprise(active.sessionId, organizationId);

  /**
   * Retour à l'accueil, et pas un simple rafraîchissement.
   *
   * Changer d'entreprise change tout ce qui est affiché. Rester sur la fiche
   * d'une facture montrerait une pièce qui n'existe pas dans la nouvelle
   * entreprise — au mieux une erreur, au pire les chiffres d'une société
   * confondus avec ceux d'une autre.
   */
  revalidatePath("/", "layout");
  redirect("/");
}

/** Entreprise active de la session, pour l'affichage. */
export async function sessionCourante() {
  return lireSession();
}

// ------------------------------------------------------------------ outils

async function ouvrirSessionAvecContexte(userId: string): Promise<void> {
  const entetes = await headers();

  await ouvrirSession(userId, {
    userAgent: entetes.get("user-agent") ?? undefined,
    // Derrière un proxy, l'adresse réelle est en tête ; la première valeur de
    // x-forwarded-for est celle du client.
    ipAddress:
      entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      entetes.get("x-real-ip") ??
      undefined,
  });
}
