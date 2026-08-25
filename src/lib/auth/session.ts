import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { memberships, organizations, sessions, users } from "@/db/schema";
import { newId } from "@/lib/ids";

export const COOKIE_SESSION = "fiessou_session";

/** Trente jours : une caisse ne redemande pas ses identifiants chaque matin. */
const DUREE_SESSION_JOURS = 30;

/**
 * Empreinte du jeton de session.
 *
 * SHA-256 et non argon2, délibérément. Argon2 est lent par construction, ce qui
 * protège un secret devinable — un mot de passe, un code à six chiffres. Un
 * jeton de 32 octets tirés au hasard n'est pas devinable : le ralentissement
 * n'apporterait rien et coûterait sur chaque requête authentifiée.
 *
 * Ce qui compte ici, c'est que la base ne contienne jamais le jeton en clair.
 * Une fuite de la table `sessions` ne doit permettre d'usurper personne.
 */
function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export interface SessionActive {
  sessionId: string;
  userId: string;
  nom: string;
  telephone: string;
  organizationId: string | null;
  organizationNom: string | null;
  roleId: string | null;
}

/**
 * Ouvre une session et dépose le cookie.
 *
 * Le jeton n'existe en clair qu'ici et dans le cookie du client ; la base n'en
 * garde que l'empreinte.
 */
export async function ouvrirSession(
  userId: string,
  contexte: { deviceId?: string; userAgent?: string; ipAddress?: string } = {},
): Promise<void> {
  const jeton = randomBytes(32).toString("base64url");
  const expiration = new Date(
    Date.now() + DUREE_SESSION_JOURS * 24 * 60 * 60 * 1000,
  );

  await db.insert(sessions).values({
    id: newId(),
    userId,
    tokenHash: empreinte(jeton),
    deviceId: contexte.deviceId ?? null,
    userAgent: contexte.userAgent ?? null,
    ipAddress: contexte.ipAddress ?? null,
    expiresAt: expiration,
  });

  const magasin = await cookies();
  magasin.set(COOKIE_SESSION, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiration,
  });
}

/**
 * Lit la session courante depuis le cookie.
 *
 * Renvoie null sans distinguer les causes — cookie absent, session expirée,
 * révoquée ou inconnue aboutissent au même résultat : pas de session.
 */
export async function lireSession(): Promise<SessionActive | null> {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_SESSION)?.value;
  if (!jeton) return null;

  const lignes = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      nom: users.fullName,
      telephone: users.phone,
      statut: users.status,
      organizationId: sessions.organizationId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, empreinte(jeton)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const ligne = lignes[0];
  if (!ligne || ligne.statut !== "actif") return null;

  // L'entreprise active peut ne pas être encore choisie : un utilisateur peut
  // appartenir à plusieurs entreprises, ou à aucune juste après inscription.
  let organizationNom: string | null = null;
  let roleId: string | null = null;

  if (ligne.organizationId) {
    const rattachements = await db
      .select({ nom: organizations.name, roleId: memberships.roleId })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(
        and(
          eq(memberships.userId, ligne.userId),
          eq(memberships.organizationId, ligne.organizationId),
          eq(memberships.status, "actif"),
        ),
      )
      .limit(1);

    // Un rattachement révoqué invalide l'entreprise active, pas la session.
    organizationNom = rattachements[0]?.nom ?? null;
    roleId = rattachements[0]?.roleId ?? null;
  }

  return {
    sessionId: ligne.sessionId,
    userId: ligne.userId,
    nom: ligne.nom,
    telephone: ligne.telephone,
    organizationId: organizationNom ? ligne.organizationId : null,
    organizationNom,
    roleId,
  };
}

/** Choisit l'entreprise active de la session en cours. */
export async function choisirEntreprise(
  sessionId: string,
  organizationId: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ organizationId, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/**
 * Ferme la session courante.
 *
 * La ligne est révoquée plutôt que supprimée : savoir qu'une session a existé,
 * depuis quel appareil et jusqu'à quand, fait partie de la piste d'audit.
 */
export async function fermerSession(): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_SESSION)?.value;

  if (jeton) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, empreinte(jeton)));
  }

  magasin.delete(COOKIE_SESSION);
}

/** Révoque toutes les sessions d'un utilisateur — départ, appareil perdu. */
export async function revoquerToutesLesSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
