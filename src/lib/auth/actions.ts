"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { memberships, sessions, users } from "@/db/schema";
import { env } from "@/env";
import { newId } from "@/lib/ids";
import { creerEntreprisePour } from "./creation-entreprise";
import {
  DUREE_VERROU_MINUTES,
  apresEchec,
  estVerrouille,
  motifRefusMotDePasse,
  normaliserEmail,
} from "./identifiants";
import { hacherMotDePasse, verifierMotDePasse } from "./mot-de-passe";
import {
  choisirEntreprise,
  fermerSession,
  lireSession,
  ouvrirSession,
} from "./session";

export interface EtatConnexion {
  erreur?: string;
  /** Adresse saisie, rendue au formulaire après un refus. */
  email?: string;
}

/** Même message pour une adresse inconnue et un mot de passe faux. */
const REFUS_CONNEXION = "Adresse e-mail ou mot de passe incorrect.";

/**
 * Connexion par adresse e-mail et mot de passe.
 *
 * La réponse ne dit jamais si l'adresse est connue : un formulaire qui répond
 * « ce compte n'existe pas » offre à qui le veut la liste de vos clients. Une
 * adresse inconnue fait même travailler Argon2 sur un leurre, pour répondre
 * dans le même temps qu'une adresse connue.
 *
 * Cinq échecs consécutifs verrouillent le compte quinze minutes. Le verrou se
 * dit, lui : il ne révèle rien qu'un essai de plus n'aurait appris.
 */
export async function seConnecter(
  _precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const saisie = String(donnees.get("email") ?? "");
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const email = normaliserEmail(saisie);

  if (!email || motDePasse.length === 0) {
    return { email: saisie, erreur: "Indiquez votre adresse e-mail et votre mot de passe." };
  }

  const [compte] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      status: users.status,
      failedLogins: users.failedLogins,
      lockedUntil: users.lockedUntil,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (compte && estVerrouille(compte.lockedUntil)) {
    return {
      email,
      erreur: `Trop d'essais infructueux. Réessayez dans ${DUREE_VERROU_MINUTES} minutes.`,
    };
  }

  const valide = await verifierMotDePasse(compte?.passwordHash ?? null, motDePasse);

  if (!compte || !valide) {
    if (compte) {
      const suite = apresEchec(compte.failedLogins);
      await db
        .update(users)
        .set({ ...suite, updatedAt: new Date() })
        .where(eq(users.id, compte.id));
    }
    return { email, erreur: REFUS_CONNEXION };
  }

  if (compte.status !== "actif") {
    return {
      email,
      erreur: "Ce compte est suspendu. Adressez-vous au responsable de votre entreprise.",
    };
  }

  await db
    .update(users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, compte.id));

  await ouvrirSessionAvecContexte(compte.id);
  redirect("/");
}

export interface EtatInscription {
  erreur?: string;
  valeurs?: { nom?: string; entreprise?: string; email?: string };
}

const schemaInscription = z.object({
  nom: z.string().trim().min(2, "Indiquez votre nom."),
  entreprise: z.string().trim().min(2, "Indiquez le nom de votre entreprise."),
});

/**
 * Création d'un compte et de son entreprise.
 *
 * L'utilisateur, son entreprise, le rôle de propriétaire et le rattachement
 * naissent dans une seule transaction. Un compte sans entreprise, ou une
 * entreprise sans propriétaire, laisserait quelqu'un connecté devant une
 * application vide sans moyen d'en sortir.
 *
 * Une adresse déjà prise est signalée : la contrainte d'unicité le dirait de
 * toute façon, et la personne doit savoir qu'elle a déjà un compte plutôt que
 * d'en chercher un second.
 */
export async function sInscrire(
  _precedent: EtatInscription,
  donnees: FormData,
): Promise<EtatInscription> {
  const valeurs = {
    nom: String(donnees.get("nom") ?? ""),
    entreprise: String(donnees.get("entreprise") ?? ""),
    email: String(donnees.get("email") ?? ""),
  };
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");

  const analyse = schemaInscription.safeParse(valeurs);
  if (!analyse.success) return { valeurs, erreur: analyse.error.issues[0].message };

  const email = normaliserEmail(valeurs.email);
  if (!email) return { valeurs, erreur: "Adresse e-mail invalide." };

  const refus = motifRefusMotDePasse(motDePasse, { email });
  if (refus) return { valeurs, erreur: refus };
  if (motDePasse !== confirmation) {
    return { valeurs, erreur: "Les deux mots de passe ne correspondent pas." };
  }

  const userId = newId();
  const empreinte = await hacherMotDePasse(motDePasse);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email,
        fullName: analyse.data.nom,
        passwordHash: empreinte,
        lastLoginAt: new Date(),
      });

      // L'entreprise, ses rôles et le rattachement du propriétaire naissent
      // ensemble : celui qui s'inscrit se retrouve administrateur de sa
      // boutique, ou il n'y a pas d'inscription du tout.
      await creerEntreprisePour(
        userId,
        { nom: analyse.data.entreprise, pays: env.DEFAULT_COUNTRY },
        tx,
      );
    });
  } catch (erreur) {
    if (erreur instanceof Error && "code" in erreur && erreur.code === "23505") {
      return {
        valeurs,
        erreur: "Un compte existe déjà avec cette adresse. Connectez-vous.",
      };
    }
    throw erreur;
  }

  await ouvrirSessionAvecContexte(userId);
  redirect("/");
}

export interface EtatMotDePasse {
  erreur?: string;
  change?: boolean;
}

/**
 * Change le mot de passe de la personne connectée.
 *
 * L'actuel est exigé, même provisoire : une session laissée ouverte sur la
 * caisse ne doit pas suffire à s'approprier le compte. Les autres sessions
 * sont fermées — un changement de mot de passe sert souvent à couper un
 * appareil perdu.
 */
export async function changerMotDePasse(
  _precedent: EtatMotDePasse,
  donnees: FormData,
): Promise<EtatMotDePasse> {
  const active = await lireSession();
  if (!active) redirect("/connexion");

  const actuel = String(donnees.get("actuel") ?? "");
  const nouveau = String(donnees.get("nouveau") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");

  const [compte] = await db
    .select({ passwordHash: users.passwordHash, email: users.email })
    .from(users)
    .where(eq(users.id, active.userId));

  if (!compte || !(await verifierMotDePasse(compte.passwordHash, actuel))) {
    return { erreur: "Le mot de passe actuel est incorrect." };
  }

  const refus = motifRefusMotDePasse(nouveau, { email: compte.email });
  if (refus) return { erreur: refus };
  if (nouveau === actuel) {
    return { erreur: "Le nouveau mot de passe doit différer de l'actuel." };
  }
  if (nouveau !== confirmation) {
    return { erreur: "Les deux mots de passe ne correspondent pas." };
  }

  const empreinte = await hacherMotDePasse(nouveau);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash: empreinte,
        mustChangePassword: false,
        failedLogins: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, active.userId));

    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.userId, active.userId),
          ne(sessions.id, active.sessionId),
          isNull(sessions.revokedAt),
        ),
      );
  });

  if (active.doitChangerMotDePasse) redirect("/");
  return { change: true };
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
