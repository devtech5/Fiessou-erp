import { v7 as uuidv7 } from "uuid";

/**
 * Génère un identifiant.
 *
 * UUID v7 plutôt que v4 : il commence par un horodatage, donc les
 * identifiants successifs sont proches dans l'index. Sur un journal de ventes
 * qui grossit, la différence d'écriture est nette.
 *
 * L'identifiant est produit par l'appelant — y compris par un appareil hors
 * connexion. Une vente encaissée sans réseau porte donc déjà son identifiant
 * définitif au moment où elle est imprimée sur le ticket.
 */
export function newId(): string {
  return uuidv7();
}

/**
 * Compose un numéro de pièce à partir d'un compteur.
 *
 * @example buildDocumentNumber({ prefix: "05-", value: 66854, padding: 8, suffix: "/G" })
 *          → "05-00066854/G"
 */
export function buildDocumentNumber({
  prefix = "",
  value,
  padding = 6,
  suffix = "",
}: {
  prefix?: string;
  value: number;
  padding?: number;
  suffix?: string;
}): string {
  return `${prefix}${String(value).padStart(padding, "0")}${suffix}`;
}
