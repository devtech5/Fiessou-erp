import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/env";

import type { FichierADeposer, ResultatDepot } from "./index";

/**
 * Adaptateur disque : le développement sur PGlite, et la production sur VPS
 * (dossier sur un volume persistant et sauvegardé, jamais un disque éphémère).
 *
 * Ce qui compte : un chemin préfixé par l'entreprise, aucun lien direct, une
 * URL signée qui expire. La signature
 * est un HMAC sur AUTH_SECRET : sans elle, quiconque devinerait un chemin
 * lirait la pièce.
 */

/** `<org>/<id>.<ext>` et rien d'autre : ni `..`, ni séparateur parasite. */
const CHEMIN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/;

export function cheminValide(chemin: string): boolean {
  return CHEMIN.test(chemin);
}

function racine(): string {
  // Chemin choisi à l'exécution : hors du traçage, sinon tout le projet part dans l'image.
  return path.resolve(/*turbopackIgnore: true*/ env.STOCKAGE_LOCAL ?? ".stockage");
}

function emplacement(chemin: string): string {
  if (!cheminValide(chemin)) throw new Error("Chemin de fichier invalide.");
  return path.join(/*turbopackIgnore: true*/ racine(), ...chemin.split("/"));
}

function signature(chemin: string, expire: number): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`${chemin}|${expire}`).digest("hex");
}

export async function deposerLocal(fichier: FichierADeposer): Promise<ResultatDepot> {
  try {
    const cible = emplacement(fichier.chemin);
    await mkdir(path.dirname(cible), { recursive: true });
    // `wx` : jamais d'écrasement — un chemin déjà pris est une erreur, pas une mise à jour.
    await writeFile(cible, Buffer.from(fichier.contenu), { flag: "wx" });
    return { ok: true, chemin: fichier.chemin };
  } catch (erreur) {
    return { ok: false, raison: `Dépôt refusé : ${erreur instanceof Error ? erreur.message : "erreur disque"}` };
  }
}

export async function urlSigneeLocale(chemin: string, secondes: number): Promise<string | null> {
  if (!cheminValide(chemin)) return null;
  const expire = Math.floor(Date.now() / 1000) + secondes;
  return `/fichiers/${chemin}?exp=${expire}&sig=${signature(chemin, expire)}`;
}

/** Lit un fichier si la signature est bonne et pas expirée ; `null` sinon. */
export async function lireSigne(chemin: string, expire: number, sig: string): Promise<Buffer | null> {
  if (!cheminValide(chemin) || !Number.isInteger(expire) || expire < Date.now() / 1000) return null;
  const attendue = Buffer.from(signature(chemin, expire), "hex");
  const recue = Buffer.from(sig, "hex");
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return null;
  try {
    return await readFile(emplacement(chemin));
  } catch {
    return null;
  }
}

export async function lireLocal(chemin: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(emplacement(chemin)));
  } catch {
    return null;
  }
}

export async function supprimerLocal(chemin: string): Promise<boolean> {
  try {
    await rm(emplacement(chemin), { force: true });
    return true;
  } catch {
    return false;
  }
}
