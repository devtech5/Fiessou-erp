/**
 * Jeu de démonstration — réservation de ressource.
 *
 * Un seul moteur porte cinq entrées du périmètre : location de matériel et
 * d'engins, location immobilière, matériel événementiel, hôtellerie et
 * résidences, salles de sport — et, en réflexion, salons de coiffure et
 * ateliers de couture.
 *
 * Le modèle commun ne change jamais : une ressource, un calendrier de
 * disponibilité, une grille de tarifs par durée, une caution, un contrat, un
 * état à la restitution. Ce qui varie tient au vocabulaire — une chambre
 * plutôt qu'une bétonnière, un séjour plutôt qu'une location.
 */

export type TypeRessource = "equipement" | "chambre" | "salle" | "creneau";

export type EtatRessource = "disponible" | "loue" | "maintenance" | "retire";

export interface RessourceDemo {
  id: string;
  code: string;
  designation: string;
  type: TypeRessource;
  categorie: string;
  etat: EtatRessource;
  /** Nombre d'exemplaires au parc. Une chambre est unique, pas une chaise. */
  quantite: number;
  /** Grille tarifaire. Toutes les durées ne sont pas servies partout. */
  tarifJour?: number;
  tarifSemaine?: number;
  tarifMois?: number;
  /** Dépôt de garantie exigé à la remise. */
  caution: number;
}

export const LIBELLE_TYPE: Record<TypeRessource, string> = {
  equipement: "Équipement",
  chambre: "Chambre",
  salle: "Salle",
  creneau: "Créneau",
};

export const LIBELLE_ETAT: Record<EtatRessource, string> = {
  disponible: "Disponible",
  loue: "Loué",
  maintenance: "En maintenance",
  retire: "Retiré",
};

export const RESSOURCES: RessourceDemo[] = [
  { id: "r1", code: "EQP-BET-01", designation: "Bétonnière 350 L", type: "equipement", categorie: "BTP", etat: "loue", quantite: 2, tarifJour: 15_000, tarifSemaine: 80_000, tarifMois: 280_000, caution: 150_000 },
  { id: "r2", code: "EQP-GRP-01", designation: "Groupe électrogène 15 kVA", type: "equipement", categorie: "BTP", etat: "loue", quantite: 1, tarifJour: 35_000, tarifSemaine: 190_000, tarifMois: 650_000, caution: 500_000 },
  { id: "r3", code: "EQP-ECH-01", designation: "Échafaudage 6 m — lot", type: "equipement", categorie: "BTP", etat: "disponible", quantite: 4, tarifJour: 8_000, tarifSemaine: 45_000, tarifMois: 150_000, caution: 80_000 },
  { id: "r4", code: "EQP-MAR-01", designation: "Marteau-piqueur", type: "equipement", categorie: "BTP", etat: "maintenance", quantite: 1, tarifJour: 20_000, tarifSemaine: 110_000, caution: 200_000 },
  { id: "r5", code: "EVT-CHA-01", designation: "Chaise plastique — lot de 50", type: "equipement", categorie: "Événementiel", etat: "disponible", quantite: 12, tarifJour: 12_500, caution: 50_000 },
  { id: "r6", code: "EVT-BAC-01", designation: "Bâche 6 × 12 m", type: "equipement", categorie: "Événementiel", etat: "loue", quantite: 3, tarifJour: 40_000, caution: 100_000 },
  { id: "r7", code: "EVT-SON-01", designation: "Sonorisation 2 × 500 W", type: "equipement", categorie: "Événementiel", etat: "disponible", quantite: 2, tarifJour: 75_000, caution: 300_000 },
  { id: "r8", code: "RES-C101", designation: "Studio meublé 101", type: "chambre", categorie: "Résidence Cocody", etat: "loue", quantite: 1, tarifJour: 25_000, tarifSemaine: 150_000, tarifMois: 450_000, caution: 450_000 },
  { id: "r9", code: "RES-C102", designation: "Studio meublé 102", type: "chambre", categorie: "Résidence Cocody", etat: "disponible", quantite: 1, tarifJour: 25_000, tarifSemaine: 150_000, tarifMois: 450_000, caution: 450_000 },
  { id: "r10", code: "RES-C201", designation: "Appartement 2 pièces 201", type: "chambre", categorie: "Résidence Cocody", etat: "loue", quantite: 1, tarifJour: 40_000, tarifSemaine: 240_000, tarifMois: 700_000, caution: 700_000 },
  { id: "r11", code: "SAL-FET-01", designation: "Salle de fête — 150 places", type: "salle", categorie: "Événementiel", etat: "disponible", quantite: 1, tarifJour: 250_000, caution: 200_000 },
];

// --------------------------------------------------------------- contrats

export type StatutContrat =
  | "reserve"
  | "en_cours"
  | "restitue"
  | "en_retard"
  | "annule";

export type EtatRestitution = "bon" | "endommage" | "perdu";

export interface ContratDemo {
  id: string;
  numero: string;
  ressource: string;
  codeRessource: string;
  client: string;
  debut: string;
  fin: string;
  jours: number;
  quantite: number;
  tarifApplique: number;
  montant: number;
  caution: number;
  statut: StatutContrat;
  /** Renseigné seulement une fois le matériel rendu. */
  etatRestitution?: EtatRestitution;
  /** Somme prélevée sur la caution en cas de dégât ou de retard. */
  retenue?: number;
}

export const LIBELLE_CONTRAT: Record<StatutContrat, string> = {
  reserve: "Réservé",
  en_cours: "En cours",
  restitue: "Restitué",
  en_retard: "En retard",
  annule: "Annulé",
};

export const LIBELLE_RESTITUTION: Record<EtatRestitution, string> = {
  bon: "Bon état",
  endommage: "Endommagé",
  perdu: "Perdu",
};

export const CONTRATS: ContratDemo[] = [
  { id: "c1", numero: "LOC-2026-0087", ressource: "Bétonnière 350 L", codeRessource: "EQP-BET-01", client: "Ets Sopé Naby", debut: "20/08/2026", fin: "27/08/2026", jours: 7, quantite: 1, tarifApplique: 80_000, montant: 80_000, caution: 150_000, statut: "en_cours" },
  { id: "c2", numero: "LOC-2026-0086", ressource: "Groupe électrogène 15 kVA", codeRessource: "EQP-GRP-01", client: "Restaurant Akwaba", debut: "22/08/2026", fin: "24/08/2026", jours: 3, quantite: 1, tarifApplique: 35_000, montant: 105_000, caution: 500_000, statut: "en_retard" },
  { id: "c3", numero: "LOC-2026-0085", ressource: "Bâche 6 × 12 m", codeRessource: "EVT-BAC-01", client: "Kouadio Yao", debut: "23/08/2026", fin: "26/08/2026", jours: 3, quantite: 2, tarifApplique: 40_000, montant: 240_000, caution: 200_000, statut: "en_cours" },
  { id: "c4", numero: "LOC-2026-0084", ressource: "Sonorisation 2 × 500 W", codeRessource: "EVT-SON-01", client: "Maquis Le Baoulé", debut: "15/08/2026", fin: "17/08/2026", jours: 2, quantite: 1, tarifApplique: 75_000, montant: 150_000, caution: 300_000, statut: "restitue", etatRestitution: "endommage", retenue: 45_000 },
  { id: "c5", numero: "LOC-2026-0083", ressource: "Chaise plastique — lot de 50", codeRessource: "EVT-CHA-01", client: "Restaurant Akwaba", debut: "10/08/2026", fin: "12/08/2026", jours: 2, quantite: 4, tarifApplique: 12_500, montant: 100_000, caution: 200_000, statut: "restitue", etatRestitution: "bon" },
  { id: "c6", numero: "LOC-2026-0088", ressource: "Échafaudage 6 m — lot", codeRessource: "EQP-ECH-01", client: "Quincaillerie Adjamé", debut: "28/08/2026", fin: "04/09/2026", jours: 7, quantite: 2, tarifApplique: 45_000, montant: 90_000, caution: 160_000, statut: "reserve" },
  { id: "c7", numero: "SEJ-2026-0042", ressource: "Studio meublé 101", codeRessource: "RES-C101", client: "Traoré Fatou", debut: "01/08/2026", fin: "31/08/2026", jours: 30, quantite: 1, tarifApplique: 450_000, montant: 450_000, caution: 450_000, statut: "en_cours" },
  { id: "c8", numero: "SEJ-2026-0041", ressource: "Appartement 2 pièces 201", codeRessource: "RES-C201", client: "Pharmacie du Plateau", debut: "15/08/2026", fin: "14/09/2026", jours: 30, quantite: 1, tarifApplique: 700_000, montant: 700_000, caution: 700_000, statut: "en_cours" },
];

/**
 * Montant d'une location.
 *
 * Le tarif appliqué dépend de la durée : au-delà d'une semaine ou d'un mois, la
 * grille bascule sur le forfait correspondant plutôt que de multiplier le
 * tarif journalier. Sans cela, une location d'un mois coûterait plus cher que
 * le matériel lui-même et personne ne signerait.
 */
export function tarifPourDuree(
  ressource: RessourceDemo,
  jours: number,
): { montantUnitaire: number; base: string } {
  if (jours >= 30 && ressource.tarifMois) {
    return { montantUnitaire: ressource.tarifMois * Math.floor(jours / 30), base: "mois" };
  }
  if (jours >= 7 && ressource.tarifSemaine) {
    return {
      montantUnitaire: ressource.tarifSemaine * Math.floor(jours / 7),
      base: "semaine",
    };
  }
  return { montantUnitaire: (ressource.tarifJour ?? 0) * jours, base: "jour" };
}

// ---------------------------------------------------------------- planning

/** Jours affichés dans le planning, à partir du 25 août 2026. */
export const JOURS_PLANNING = Array.from({ length: 14 }, (_, i) => {
  const date = new Date(2026, 7, 25 + i);
  return {
    cle: `${date.getDate()}/${date.getMonth() + 1}`,
    jour: date.getDate(),
    libelleJour: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"][date.getDay()],
    weekend: date.getDay() === 0 || date.getDay() === 6,
  };
});

/**
 * Occupation d'une ressource, jour par jour, sur la période affichée.
 *
 * L'unité est le nombre d'exemplaires pris, pas un simple « occupé ». Un parc
 * de douze lots de chaises dont quatre sont sortis reste disponible : réduire
 * la disponibilité à un booléen interdirait la moitié des locations possibles.
 */
export interface OccupationJour {
  ressourceId: string;
  index: number;
  pris: number;
  contrat: string;
}

export const OCCUPATION: OccupationJour[] = [
  // Bétonnière — 1 exemplaire sur 2, jusqu'au 27
  ...[0, 1, 2].map((i) => ({ ressourceId: "r1", index: i, pris: 1, contrat: "LOC-2026-0087" })),
  // Groupe électrogène — l'unique exemplaire, contrat en retard
  ...[0].map((i) => ({ ressourceId: "r2", index: i, pris: 1, contrat: "LOC-2026-0086" })),
  // Échafaudage — réservation à venir, 2 lots sur 4
  ...[3, 4, 5, 6, 7, 8, 9, 10].map((i) => ({ ressourceId: "r3", index: i, pris: 2, contrat: "LOC-2026-0088" })),
  // Bâches — 2 sur 3
  ...[0, 1].map((i) => ({ ressourceId: "r6", index: i, pris: 2, contrat: "LOC-2026-0085" })),
  // Studio 101 — occupé jusqu'à fin août
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ ressourceId: "r8", index: i, pris: 1, contrat: "SEJ-2026-0042" })),
  // Appartement 201 — occupé sur toute la période
  ...JOURS_PLANNING.map((_, i) => ({ ressourceId: "r10", index: i, pris: 1, contrat: "SEJ-2026-0041" })),
];

/** Exemplaires restants d'une ressource à une date donnée. */
export function disponibleLe(ressource: RessourceDemo, index: number): number {
  const pris = OCCUPATION.filter(
    (o) => o.ressourceId === ressource.id && o.index === index,
  ).reduce((somme, o) => somme + o.pris, 0);
  return ressource.quantite - pris;
}

// ------------------------------------------------------------ abonnements

export type PeriodiciteAbonnement = "seance" | "mensuel" | "trimestriel" | "annuel";

export interface AbonnementDemo {
  id: string;
  codeAdherent: string;
  nom: string;
  formule: string;
  periodicite: PeriodiciteAbonnement;
  debut: string;
  fin: string;
  montant: number;
  /** Nul pour un accès illimité. */
  seancesIncluses: number | null;
  seancesConsommees: number;
  derniereVenue: string;
}

export const LIBELLE_PERIODICITE: Record<PeriodiciteAbonnement, string> = {
  seance: "À la séance",
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  annuel: "Annuel",
};

export const ABONNEMENTS: AbonnementDemo[] = [
  { id: "ab1", codeAdherent: "AA01", nom: "Yao Prince", formule: "Illimité mensuel", periodicite: "mensuel", debut: "01/08/2026", fin: "31/08/2026", montant: 25_000, seancesIncluses: null, seancesConsommees: 18, derniereVenue: "Aujourd'hui" },
  { id: "ab2", codeAdherent: "AB02", nom: "Aya Danielle", formule: "12 séances", periodicite: "seance", debut: "05/08/2026", fin: "05/10/2026", montant: 18_000, seancesIncluses: 12, seancesConsommees: 11, derniereVenue: "Hier" },
  { id: "ab3", codeAdherent: "AC03", nom: "Konan Michel", formule: "Trimestriel", periodicite: "trimestriel", debut: "01/07/2026", fin: "30/09/2026", montant: 65_000, seancesIncluses: null, seancesConsommees: 42, derniereVenue: "23/08/2026" },
  { id: "ab4", codeAdherent: "AD04", nom: "Bamba Souleymane", formule: "8 séances", periodicite: "seance", debut: "12/08/2026", fin: "12/09/2026", montant: 13_000, seancesIncluses: 8, seancesConsommees: 8, derniereVenue: "21/08/2026" },
  { id: "ab5", codeAdherent: "AE05", nom: "Traoré Fatou", formule: "Illimité mensuel", periodicite: "mensuel", debut: "10/08/2026", fin: "09/09/2026", montant: 25_000, seancesIncluses: null, seancesConsommees: 9, derniereVenue: "24/08/2026" },
  { id: "ab6", codeAdherent: "AF06", nom: "Koné Salif", formule: "Annuel", periodicite: "annuel", debut: "01/02/2026", fin: "31/01/2027", montant: 210_000, seancesIncluses: null, seancesConsommees: 156, derniereVenue: "Aujourd'hui" },
];

/** Séances restantes, ou null pour un accès illimité. */
export function seancesRestantes(abonnement: AbonnementDemo): number | null {
  if (abonnement.seancesIncluses === null) return null;
  return abonnement.seancesIncluses - abonnement.seancesConsommees;
}
