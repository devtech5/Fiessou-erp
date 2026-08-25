import "server-only";

import { randomInt } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { verificationCodes } from "@/db/schema";
import { env } from "@/env";
import { newId } from "@/lib/ids";

/** Durée de vie d'un code. Assez pour recevoir un SMS, pas plus. */
const VALIDITE_MINUTES = 10;

/** Au-delà, le code est brûlé : une force brute sur six chiffres est rapide. */
const TENTATIVES_MAX = 5;

/** Délai minimal entre deux envois au même destinataire. */
const DELAI_RENVOI_SECONDES = 60;

export type ResultatVerification =
  | { ok: true }
  | { ok: false; raison: "invalide" | "expire" | "trop_de_tentatives" };

/**
 * Six chiffres tirés au hasard cryptographique.
 *
 * `randomInt` et non `Math.random` : le second est prévisible, et un code de
 * connexion prévisible n'est pas un code.
 */
function genererCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Normalise un numéro ivoirien vers le format E.164.
 *
 * Les gens saisissent « 07 08 12 34 56 », « 0708123456 » ou « +225 07... ».
 * Sans normalisation, le même utilisateur crée trois comptes.
 */
export function normaliserTelephone(saisie: string): string | null {
  const chiffres = saisie.replace(/[^\d+]/g, "");

  if (chiffres.startsWith("+")) {
    return /^\+\d{8,15}$/.test(chiffres) ? chiffres : null;
  }

  // Numéro national ivoirien : dix chiffres depuis le passage au format 2021.
  if (/^\d{10}$/.test(chiffres)) return `+225${chiffres}`;

  return null;
}

/**
 * Émet un code et le remet au destinataire.
 *
 * Le code n'est jamais stocké en clair. Argon2 ici, contrairement aux jetons de
 * session : six chiffres se parcourent en entier en un instant, le coût de
 * calcul est la seule chose qui rende une fuite de table inexploitable.
 */
export async function emettreCode(
  destination: string,
  purpose: "connexion" | "inscription" | "reinitialisation" | "verification_telephone",
): Promise<{ ok: true } | { ok: false; raison: "trop_frequent" }> {
  const recents = await db
    .select({ createdAt: verificationCodes.createdAt })
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.destination, destination),
        eq(verificationCodes.purpose, purpose),
        gt(
          verificationCodes.createdAt,
          new Date(Date.now() - DELAI_RENVOI_SECONDES * 1000),
        ),
      ),
    )
    .limit(1);

  if (recents.length > 0) return { ok: false, raison: "trop_frequent" };

  // Les codes encore valides du même destinataire sont consommés : deux codes
  // vivants en même temps doublent la surface d'attaque sans rien apporter.
  await db
    .update(verificationCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(verificationCodes.destination, destination),
        eq(verificationCodes.purpose, purpose),
        isNull(verificationCodes.consumedAt),
      ),
    );

  const code = genererCode();

  await db.insert(verificationCodes).values({
    id: newId(),
    destination,
    channel: env.OTP_CHANNEL === "console" ? "sms" : env.OTP_CHANNEL,
    purpose,
    codeHash: await hash(code),
    maxAttempts: TENTATIVES_MAX,
    expiresAt: new Date(Date.now() + VALIDITE_MINUTES * 60 * 1000),
  });

  await remettreCode(destination, code);
  return { ok: true };
}

/**
 * Achemine le code vers le destinataire.
 *
 * Un seul canal est implémenté : la console, pour le développement. SMS et
 * WhatsApp attendent le choix d'un opérateur — ce choix a un coût par message
 * et engage la marge du produit, il ne se tranche pas dans un fichier.
 */
async function remettreCode(destination: string, code: string): Promise<void> {
  if (env.OTP_CHANNEL === "console") {
    console.info(`\n  Code de connexion pour ${destination} : ${code}\n`);
    return;
  }

  throw new Error(
    `Canal « ${env.OTP_CHANNEL} » non implémenté. Aucun opérateur n'est encore branché.`,
  );
}

/**
 * Vérifie un code saisi.
 *
 * Chaque tentative est comptée avant d'être évaluée : sans cela, un attaquant
 * qui interrompt la requête au bon moment essaierait indéfiniment.
 */
export async function verifierCode(
  destination: string,
  purpose: "connexion" | "inscription" | "reinitialisation" | "verification_telephone",
  saisie: string,
): Promise<ResultatVerification> {
  const lignes = await db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.destination, destination),
        eq(verificationCodes.purpose, purpose),
        isNull(verificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  const ligne = lignes[0];
  if (!ligne) return { ok: false, raison: "invalide" };

  if (ligne.expiresAt < new Date()) return { ok: false, raison: "expire" };

  if (ligne.attempts >= ligne.maxAttempts) {
    return { ok: false, raison: "trop_de_tentatives" };
  }

  await db
    .update(verificationCodes)
    .set({ attempts: sql`${verificationCodes.attempts} + 1` })
    .where(eq(verificationCodes.id, ligne.id));

  const correspond = await verify(ligne.codeHash, saisie);
  if (!correspond) return { ok: false, raison: "invalide" };

  // Un code valide ne sert qu'une fois.
  await db
    .update(verificationCodes)
    .set({ consumedAt: new Date() })
    .where(eq(verificationCodes.id, ligne.id));

  return { ok: true };
}
