import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/env";

/**
 * Liens publics signés : ce qu'un client ouvre sans compte — sa facture, la
 * page qui le désinscrit des messages.
 *
 * Le jeton porte son objet et son expiration en clair, et une signature HMAC
 * de l'ensemble avec `AUTH_SECRET`. Changer une lettre de l'identifiant ou
 * repousser l'expiration casse la signature : le lien ne donne accès qu'à ce
 * qu'il nomme, et seulement jusqu'à la date prévue. Rien n'est stocké en base.
 */

const SEPARATEUR = "~";

function signer(contenu: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(contenu).digest("base64url");
}

/** Jeton pour `parties` (sans `~`), valable `jours` jours. */
export function signerLien(parties: string[], jours: number, maintenant = Date.now()): string {
  if (parties.some((p) => p.includes(SEPARATEUR))) throw new Error("Partie de lien invalide.");
  const expire = Math.floor(maintenant / 1000) + jours * 86_400;
  const contenu = [...parties, String(expire)].join(SEPARATEUR);
  return `${Buffer.from(contenu).toString("base64url")}.${signer(contenu)}`;
}

/** Parties du jeton s'il est intact et non expiré, `null` sinon. */
export function verifierLien(jeton: string, maintenant = Date.now()): string[] | null {
  const [charge, signature] = jeton.split(".");
  if (!charge || !signature) return null;
  let contenu: string;
  try {
    contenu = Buffer.from(charge, "base64url").toString();
  } catch {
    return null;
  }
  const attendue = Buffer.from(signer(contenu));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return null;
  const parties = contenu.split(SEPARATEUR);
  const expire = Number(parties.pop());
  if (!Number.isFinite(expire) || expire * 1000 < maintenant) return null;
  return parties;
}

/** Adresse absolue d'un chemin, pour un lien envoyé hors de l'application. */
export function urlAbsolue(chemin: string): string {
  const base = (env.URL_PUBLIQUE ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${chemin}`;
}
