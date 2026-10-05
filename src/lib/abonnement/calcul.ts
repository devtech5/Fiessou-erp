/**
 * Abonnement d'une entreprise à Fiessou. Règles pures.
 *
 * Pas de coupure brutale : une échéance passée laisse sept jours de grâce,
 * puis l'entreprise passe en LECTURE SEULE. Elle voit toujours ses chiffres,
 * ses factures, sa comptabilité — elle ne peut plus en créer. Couper l'accès
 * aux données d'un commerçant pour un retard de paiement serait le meilleur
 * moyen de le perdre, et de lui donner raison.
 */

export const JOURS_GRACE = 7;
/** Le bandeau prévient à partir de ce nombre de jours avant l'échéance. */
export const JOURS_PREAVIS = 10;

export type StatutOrganisation = "essai" | "actif" | "suspendu" | "resilie";
export type Phase = "essai" | "actif" | "grace" | "expire" | "suspendu" | "resilie";

export interface EtatAbonnement {
  phase: Phase;
  /** `lecture` : seuls les droits de consultation restent. */
  acces: "complet" | "lecture";
  /** Dernier jour couvert (essai ou paiement), AAAA-MM-JJ. */
  finLe: string | null;
  /** Jours avant la fin (négatif : jours depuis). */
  jours: number | null;
  /** Ce que le bandeau dit ; nul quand il n'y a rien à dire. */
  message: string | null;
  gravite: "info" | "attention" | "critique" | null;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

export function ecartJours(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / JOUR_MS);
}

export function ajouterJours(jour: string, n: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + n * JOUR_MS).toISOString().slice(0, 10);
}

/**
 * Ajoute des mois à une date en restant dans le mois visé : le 31 janvier
 * plus un mois donne le 28 (ou 29) février, pas le 3 mars.
 */
export function ajouterMois(jour: string, mois: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + mois, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible.toISOString().slice(0, 10);
}

/**
 * Période couverte par un paiement de `mois` mois : elle part du lendemain de
 * l'échéance en cours si l'entreprise est à jour — un paiement anticipé ne
 * fait pas perdre de jours —, sinon d'aujourd'hui.
 */
export function periodeCouverte(payeJusquAu: string | null, aujourdhui: string, mois: number): { du: string; au: string } {
  if (!Number.isInteger(mois) || mois === 0) throw new Error("Nombre de mois invalide.");
  if (mois < 0) {
    // Correction d'un paiement : on retire des mois à l'échéance existante.
    if (!payeJusquAu) throw new Error("Aucune période payée à corriger.");
    return { du: ajouterMois(payeJusquAu, mois), au: ajouterMois(payeJusquAu, mois) };
  }
  const du = payeJusquAu && payeJusquAu >= aujourdhui ? ajouterJours(payeJusquAu, 1) : aujourdhui;
  return { du, au: ajouterJours(ajouterMois(du, mois), -1) };
}

export function etatAbonnement(
  o: { statut: StatutOrganisation; essaiFinLe: string | null; payeJusquAu: string | null },
  aujourdhui: string,
): EtatAbonnement {
  if (o.statut === "suspendu") {
    return { phase: "suspendu", acces: "lecture", finLe: o.payeJusquAu, jours: null, message: "Compte suspendu : l'entreprise est en lecture seule. Contactez Fiessou.", gravite: "critique" };
  }
  if (o.statut === "resilie") {
    return { phase: "resilie", acces: "lecture", finLe: o.payeJusquAu, jours: null, message: "Abonnement résilié : vos données restent consultables, en lecture seule.", gravite: "critique" };
  }

  // Un paiement l'emporte sur l'essai, même pendant celui-ci.
  const finLe = o.payeJusquAu && (!o.essaiFinLe || o.payeJusquAu >= o.essaiFinLe) ? o.payeJusquAu : o.essaiFinLe;
  const enEssai = finLe === o.essaiFinLe && o.statut === "essai";
  if (!finLe) return { phase: o.statut === "essai" ? "essai" : "actif", acces: "complet", finLe: null, jours: null, message: null, gravite: null };

  const jours = ecartJours(aujourdhui, finLe);
  if (jours >= 0) {
    const phase: Phase = enEssai ? "essai" : "actif";
    const pluriel = jours > 1 ? "s" : "";
    if (enEssai) {
      return {
        phase,
        acces: "complet",
        finLe,
        jours,
        message: jours === 0 ? "Dernier jour de votre essai gratuit." : `Essai gratuit : ${jours} jour${pluriel} restant${pluriel}.`,
        gravite: jours <= 3 ? "attention" : "info",
      };
    }
    return {
      phase,
      acces: "complet",
      finLe,
      jours,
      message: jours <= JOURS_PREAVIS ? (jours === 0 ? "Votre abonnement se termine aujourd'hui." : `Votre abonnement se termine dans ${jours} jour${pluriel}.`) : null,
      gravite: jours <= JOURS_PREAVIS ? "attention" : null,
    };
  }

  const retard = -jours;
  if (retard <= JOURS_GRACE) {
    const reste = JOURS_GRACE - retard;
    return {
      phase: "grace",
      acces: "complet",
      finLe,
      jours,
      message: `${enEssai ? "Essai terminé" : "Abonnement échu"} : passage en lecture seule ${reste === 0 ? "demain" : `dans ${reste + 1} jours`}. Renouvelez pour continuer à travailler.`,
      gravite: "critique",
    };
  }
  return {
    phase: "expire",
    acces: "lecture",
    finLe,
    jours,
    message: `${enEssai ? "Essai terminé" : "Abonnement échu"} : l'entreprise est en lecture seule. Vos données sont intactes ; renouvelez pour reprendre.`,
    gravite: "critique",
  };
}

/** En lecture seule, ne restent que les droits de consultation. */
export const estDroitDeLecture = (droit: string) => droit.endsWith(".consulter");

// ---------------------------------------------------------------- formules

export interface Formule {
  cle: string;
  nom: string;
  /** FCFA par mois. Nul tant que le tarif n'est pas arrêté : « sur demande ». */
  prixMensuel: number | null;
  resume: string;
  inclus: string[];
}

/**
 * Formules proposées. Les PRIX restent à fixer par Fiessou : tant qu'ils sont
 * nuls, l'écran affiche « tarif sur demande » plutôt qu'un chiffre inventé.
 * Le module débloqué ne dépend pas de la formule — elle sert à facturer.
 */
export const FORMULES: Formule[] = [
  {
    cle: "essentiel",
    nom: "Essentiel",
    prixMensuel: null,
    resume: "Le commerce au quotidien",
    inclus: ["Caisse hors connexion et tickets", "Stock et inventaire", "Clients, fournisseurs, devis et factures", "Tableau de bord"],
  },
  {
    cle: "pro",
    nom: "Pro",
    prixMensuel: null,
    resume: "La gestion complète",
    inclus: ["Tout Essentiel", "Comptabilité SYSCOHADA, TVA et clôture", "Trésorerie, achats et paie", "Personnel, intervenants et tâches"],
  },
  {
    cle: "entreprise",
    nom: "Entreprise",
    prixMensuel: null,
    resume: "Plusieurs sites, tous les métiers",
    inclus: ["Tout Pro", "Modules métier (réservations, billetterie, projets, missions…)", "Accompagnement à la mise en place"],
  },
];

export const formule = (cle: string | null) => FORMULES.find((f) => f.cle === cle) ?? null;
