import type { Droit } from "@/lib/droits/catalogue";
import { montantLigne } from "@/lib/quantite";

/**
 * Règles de la salle, sans base ni React : ce qui se décide ici se teste.
 *
 * Le restaurant et le maquis partagent le moteur. Ce qui les sépare tient dans
 * `ESPACES` : le nom, l'adresse des écrans, le préfixe des commandes, le module
 * du registre qui les ouvre et les facture.
 */

export type Espace = "restaurant" | "maquis";
export type Poste = "cuisine" | "bar";
export type Etat = "envoyee" | "prete" | "servie" | "annulee";

export interface DefinitionEspace {
  cle: Espace;
  /** Clé du registre : ouverture du module et droits. */
  module: Espace;
  titre: string;
  racine: string;
  /** Préfixe des numéros de commande : « CMD-2026-00042 ». */
  prefixe: string;
  /** Le restaurant compte ses couverts ; au maquis, on s'assoit à six autour de trois bières. */
  couverts: boolean;
  /** Nom de l'écran de production des plats. */
  cuisine: string;
}

export const ESPACES: Record<Espace, DefinitionEspace> = {
  restaurant: {
    cle: "restaurant",
    module: "restaurant",
    titre: "Restaurant",
    racine: "/restaurant",
    prefixe: "CMD",
    couverts: true,
    cuisine: "Cuisine",
  },
  maquis: {
    cle: "maquis",
    module: "maquis",
    titre: "Maquis",
    racine: "/maquis",
    prefixe: "MQ",
    couverts: false,
    cuisine: "Grill et cuisine",
  },
};

/** Les droits de chaque espace : mêmes gestes, modules distincts. */
export const DROITS_ESPACE = {
  restaurant: {
    consulter: "restaurant.consulter",
    prendre: "restaurant.commande.prendre",
    encaisser: "restaurant.commande.encaisser",
    annuler: "restaurant.commande.annuler",
    preparer: "restaurant.cuisine.preparer",
    gerer: "restaurant.salle.gerer",
  },
  maquis: {
    consulter: "maquis.consulter",
    prendre: "maquis.commande.prendre",
    encaisser: "maquis.commande.encaisser",
    annuler: "maquis.commande.annuler",
    preparer: "maquis.cuisine.preparer",
    gerer: "maquis.salle.gerer",
  },
} as const satisfies Record<Espace, Record<string, Droit>>;

export type GesteSalle = keyof (typeof DROITS_ESPACE)["restaurant"];

export const LIBELLE_POSTE: Record<Poste, string> = { cuisine: "Cuisine", bar: "Bar" };

export const LIBELLE_ETAT: Record<Etat, string> = {
  envoyee: "En préparation",
  prete: "Prête",
  servie: "Servie",
  annulee: "Annulée",
};

/**
 * Poste de préparation proposé pour un article.
 *
 * Ce qui sort du stock tel quel — la bière, le jus, l'eau — part au bar ; ce
 * qui se prépare sans stock suivi — le plat, la grillade — part en cuisine.
 * C'est la règle du terrain tant que les fiches techniques ne disent pas ce
 * qu'un plat consomme. Le serveur peut la renverser ligne par ligne.
 */
export function posteParDefaut(article: { service: boolean }): Poste {
  return article.service ? "cuisine" : "bar";
}

/**
 * Passages permis d'un état à l'autre.
 *
 * La boisson servie au comptoir passe directement d'envoyée à servie. Une
 * ligne annulée ne revient pas : on renvoie une nouvelle ligne, et l'annulée
 * reste au dossier avec son motif.
 */
const PASSAGES: Record<Etat, readonly Etat[]> = {
  envoyee: ["prete", "servie", "annulee"],
  prete: ["servie", "annulee"],
  servie: ["annulee"],
  annulee: [],
};

export function passagePermis(de: Etat, vers: Etat): boolean {
  return PASSAGES[de].includes(vers);
}

export interface LigneComptee {
  quantite: number;
  prixUnitaire: number;
  etat: Etat;
}

/** Ce que doit la table : les lignes annulées ne se facturent pas. */
export function totalCommande(lignes: readonly LigneComptee[]): number {
  return lignes
    .filter((ligne) => ligne.etat !== "annulee")
    .reduce((somme, ligne) => somme + montantLigne(ligne.prixUnitaire, ligne.quantite), 0);
}

/** Minutes entières écoulées, jamais négatives : une horloge d'appareil en avance ne fait pas reculer le temps. */
export function minutesDepuis(debut: Date, maintenant: Date): number {
  return Math.max(0, Math.floor((maintenant.getTime() - debut.getTime()) / 60_000));
}

/** « 8 min », « 1 h 05 ». */
export function libelleDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  return `${heures} h ${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Délai au-delà duquel une ligne en préparation est en retard. Une boisson
 * qui attend dix minutes au bar est oubliée ; un plat, vingt.
 */
export const RETARD_MINUTES: Record<Poste, number> = { cuisine: 20, bar: 10 };

export function enRetard(ligne: { poste: Poste; etat: Etat; envoyeeLe: Date }, maintenant: Date): boolean {
  return ligne.etat === "envoyee" && minutesDepuis(ligne.envoyeeLe, maintenant) >= RETARD_MINUTES[ligne.poste];
}

/**
 * État d'une table sur le plan de salle.
 *
 *   · libre      — aucune commande ouverte ;
 *   · a_servir   — au moins une ligne prête attend le serveur ;
 *   · occupee    — commande ouverte, rien à porter.
 */
export type EtatTable = "libre" | "occupee" | "a_servir";

export function etatTable(commande: { lignesPretes: number } | null): EtatTable {
  if (!commande) return "libre";
  return commande.lignesPretes > 0 ? "a_servir" : "occupee";
}
