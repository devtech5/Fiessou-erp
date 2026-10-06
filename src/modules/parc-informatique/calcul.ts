/**
 * Calculs du parc informatique. Sans dépendance : testés sans base, lus par le
 * serveur et par le navigateur.
 */

export const CATEGORIES_EQUIPEMENT = {
  portable: "Ordinateur portable",
  fixe: "Ordinateur fixe",
  serveur: "Serveur",
  ecran: "Écran",
  imprimante: "Imprimante",
  reseau: "Réseau (routeur, switch, borne)",
  telephone: "Téléphone",
  tablette: "Tablette",
  onduleur: "Onduleur",
  peripherique: "Périphérique",
  autre: "Autre",
} as const;

export type CleCategorie = keyof typeof CATEGORIES_EQUIPEMENT;

/** En deçà, une licence qui expire est signalée. */
export const SEUIL_LICENCE_JOURS = 30;

export type EtatLicence = "conforme" | "depassee" | "expire_bientot" | "expiree";

/**
 * État d'une licence : plus de postes que de droits, ou fin de validité.
 *
 * Le dépassement l'emporte sur l'expiration dans l'affichage : un audit
 * d'éditeur facture les postes en trop, une licence expirée se renouvelle.
 */
export function etatLicence(licence: { postes: number; utilises: number; expireLe: string | null }, aujourdhui: string): { etat: EtatLicence; jours: number | null } {
  const jours = licence.expireLe
    ? Math.round((Date.parse(`${licence.expireLe}T12:00:00Z`) - Date.parse(`${aujourdhui}T12:00:00Z`)) / 86_400_000)
    : null;
  if (licence.utilises > licence.postes) return { etat: "depassee", jours };
  if (jours !== null && jours < 0) return { etat: "expiree", jours };
  if (jours !== null && jours <= SEUIL_LICENCE_JOURS) return { etat: "expire_bientot", jours };
  return { etat: "conforme", jours };
}

/** Adresse IPv4 ou IPv6 plausible. Le parc d'une PME est en IPv4 dans les faits. */
export function adresseIpValide(saisie: string): boolean {
  const v4 = saisie.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return v4.slice(1).every((o) => Number(o) <= 255);
  return /^[0-9a-f:]+$/i.test(saisie) && saisie.includes(":") && saisie.length <= 39;
}

/** Adresse MAC normalisée : « aa-bb-cc-dd-ee-ff » → « AA:BB:CC:DD:EE:FF ». Nul si invalide. */
export function normaliserMac(saisie: string): string | null {
  const hex = saisie.replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)!.join(":");
}

/** Clé de licence masquée : seuls les cinq derniers caractères restent lisibles. */
export function masquerCle(cle: string): string {
  if (cle.length <= 5) return "•".repeat(cle.length);
  return `${"•".repeat(Math.min(12, cle.length - 5))}${cle.slice(-5)}`;
}
