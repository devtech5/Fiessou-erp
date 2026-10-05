import { fmt } from "@/lib/format";
import { formaterQuantite, type CodeUnite } from "@/lib/quantite";
import { brutLigne, type LignePanier, type TotauxPanier } from "./panier";

/**
 * Mise en page du ticket de caisse.
 *
 * Logique pure : elle rend des lignes de texte à chasse fixe, que l'écran pose
 * dans un `<pre>` et que l'imprimante thermique restitue telles quelles. Du
 * texte plutôt que du HTML tabulaire parce qu'une imprimante 58 mm n'a pas de
 * mise en page — elle a une largeur en caractères, et c'est elle qui décide.
 *
 * Deux largeurs courantes sur le terrain : 58 mm (32 caractères) et 80 mm
 * (48 caractères).
 */

export type LargeurTicket = 58 | 80;

export const COLONNES: Record<LargeurTicket, number> = { 58: 32, 80: 48 };

export interface ReglementImprime {
  libelle: string;
  montant: number;
  reference?: string | null;
}

export interface DonneesTicket {
  boutique: string;
  /** Adresse, téléphone, identifiant fiscal : sous le nom, centrés. */
  entete?: string[];
  /** Mentions libres de l'entreprise, avant le remerciement. */
  piedDePage?: string | null;
  poste: string;
  caissier: string;
  numero: string;
  /** Horodatage ISO de l'encaissement. */
  encaisseeLe: string;
  lignes: Pick<
    LignePanier,
    "designation" | "quantite" | "prixUnitaire" | "remise" | "unite"
  >[];
  totaux: TotauxPanier;
  reglements: ReglementImprime[];
  especesRecues: number;
}

/** Complète à droite jusqu'à la largeur : « gauche      droite ». */
function aligner(gauche: string, droite: string, colonnes: number): string {
  const place = colonnes - droite.length - 1;
  const tronque = gauche.length > place ? gauche.slice(0, Math.max(0, place)) : gauche;
  return tronque.padEnd(colonnes - droite.length, " ") + droite;
}

function centrer(texte: string, colonnes: number): string {
  if (texte.length >= colonnes) return texte;
  return " ".repeat(Math.floor((colonnes - texte.length) / 2)) + texte;
}

/** Coupe un libellé long en lignes, sans casser un mot quand c'est possible. */
export function couper(texte: string, colonnes: number): string[] {
  const mots = texte.trim().split(/\s+/);
  const lignes: string[] = [];
  let courante = "";

  for (let mot of mots) {
    while (mot.length > colonnes) {
      if (courante) {
        lignes.push(courante);
        courante = "";
      }
      lignes.push(mot.slice(0, colonnes));
      mot = mot.slice(colonnes);
    }
    if (!courante) courante = mot;
    else if (courante.length + 1 + mot.length <= colonnes) courante += ` ${mot}`;
    else {
      lignes.push(courante);
      courante = mot;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

function dateTicket(iso: string): string {
  const d = new Date(iso);
  const deux = (n: number) => String(n).padStart(2, "0");
  // Abidjan est à UTC+0 toute l'année : lire l'heure UTC donne l'heure locale
  // du ticket quelle que soit la machine qui l'imprime.
  return (
    `${deux(d.getUTCDate())}/${deux(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
    `${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}`
  );
}

export function composerTicket(
  donnees: DonneesTicket,
  largeur: LargeurTicket,
): string[] {
  const n = COLONNES[largeur];
  const trait = "-".repeat(n);
  const sortie: string[] = [];

  for (const ligne of couper(donnees.boutique.toUpperCase(), n)) {
    sortie.push(centrer(ligne, n));
  }
  for (const ligne of donnees.entete ?? []) {
    for (const morceau of couper(ligne, n)) sortie.push(centrer(morceau, n));
  }
  sortie.push(centrer(`${donnees.poste} · ${donnees.caissier}`.slice(0, n), n));
  sortie.push(trait);
  sortie.push(aligner(`Ticket ${donnees.numero}`, "", n).trimEnd());
  sortie.push(dateTicket(donnees.encaisseeLe));
  sortie.push(trait);

  for (const ligne of donnees.lignes) {
    sortie.push(...couper(ligne.designation, n));

    const detail =
      `${formaterQuantite(ligne.quantite, ligne.unite as CodeUnite)} x ` +
      fmt(ligne.prixUnitaire);
    sortie.push(aligner(`  ${detail}`, fmt(brutLigne(ligne as LignePanier)), n));

    if (ligne.remise > 0) {
      sortie.push(aligner("  Remise", `-${fmt(ligne.remise)}`, n));
    }
  }

  sortie.push(trait);
  sortie.push(aligner("TOTAL", fmt(donnees.totaux.brut), n));
  if (donnees.totaux.remise > 0) {
    sortie.push(aligner("REMISE", `-${fmt(donnees.totaux.remise)}`, n));
  }
  sortie.push(aligner("TOTAL A PAYER", `${fmt(donnees.totaux.net)} F`, n));
  sortie.push(trait);

  for (const reglement of donnees.reglements) {
    sortie.push(aligner(reglement.libelle, fmt(reglement.montant), n));
    if (reglement.reference) sortie.push(`  Réf. ${reglement.reference}`.slice(0, n));
  }

  const especes = donnees.reglements
    .filter((r) => r.libelle === "Espèces")
    .reduce((somme, r) => somme + r.montant, 0);
  if (donnees.especesRecues > especes) {
    sortie.push(aligner("Reçu", fmt(donnees.especesRecues), n));
    sortie.push(aligner("Monnaie rendue", fmt(donnees.especesRecues - especes), n));
  }

  sortie.push(trait);
  for (const paragraphe of (donnees.piedDePage ?? "").split(/\r?\n/).filter((l) => l.trim())) {
    for (const morceau of couper(paragraphe, n)) sortie.push(centrer(morceau, n));
  }
  sortie.push(centrer("Merci de votre visite", n));
  return sortie;
}
