import "server-only";

import { randomInt } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";

import { motDePasseProvisoire } from "./identifiants";

/**
 * Hachage des mots de passe : Argon2id, réglages par défaut de la
 * bibliothèque (19 Mio, deux passes). Coûteux à dessein — c'est ce coût qui
 * rend une fuite de la table `users` inexploitable.
 */
export function hacherMotDePasse(motDePasse: string): Promise<string> {
  return hash(motDePasse);
}

/**
 * Empreinte d'un mot de passe que personne ne connaît, calculée une fois.
 *
 * Sert à vérifier QUELQUE CHOSE quand l'adresse est inconnue : sans cela, une
 * adresse inexistante répondrait en une milliseconde et une adresse connue en
 * cinquante, et la différence suffirait à dresser la liste des comptes.
 */
let leurre: Promise<string> | null = null;

export async function verifierMotDePasse(
  empreinte: string | null,
  motDePasse: string,
): Promise<boolean> {
  if (!empreinte) {
    leurre ??= hash(`leurre-${randomInt(0, 2 ** 31)}`);
    await verify(await leurre, motDePasse).catch(() => false);
    return false;
  }

  try {
    return await verify(empreinte, motDePasse);
  } catch {
    // Une empreinte illisible ne doit pas faire tomber la page de connexion.
    return false;
  }
}

/** Mot de passe provisoire tiré au hasard cryptographique. */
export function genererMotDePasseProvisoire(): string {
  return motDePasseProvisoire((max) => randomInt(0, max));
}
