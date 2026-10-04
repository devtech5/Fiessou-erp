import { createHash } from "node:crypto";

/**
 * Empreinte SHA-256, en hexadécimal : 64 caractères.
 *
 * Prise au dépôt sur les octets reçus, recalculée à la vérification sur les
 * octets relus dans le dépôt de fichiers. Deux empreintes égales prouvent que
 * le fichier n'a pas changé d'un octet entre-temps.
 */
export function empreinte(contenu: ArrayBuffer | Uint8Array): string {
  const octets = contenu instanceof Uint8Array ? contenu : new Uint8Array(contenu);
  return createHash("sha256").update(octets).digest("hex");
}
