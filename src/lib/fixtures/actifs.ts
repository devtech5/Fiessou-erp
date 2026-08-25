/**
 * Jeu de démonstration — actifs et maintenance.
 *
 * Un seul moteur porte cinq entrées du périmètre : parc informatique, parc
 * automobile, garage, gestion de flotte et patrimoine. Ce sont le même objet —
 * une chose affectée à quelqu'un, entretenue, avec des échéances et un coût
 * cumulé — et seuls le type et les champs de la fiche changent.
 */

export type TypeActif = "vehicule" | "informatique" | "engin" | "mobilier";

export type StatutActif = "actif" | "entretien" | "immobilise" | "cede";

export interface ActifDemo {
  id: string;
  code: string;
  designation: string;
  type: TypeActif;
  statut: StatutActif;
  /** Salarié ou intervenant à qui l'actif est confié. */
  affecteA?: string;
  site: string;
  dateAcquisition: string;
  valeurAcquisition: number;
  /** Cumul des dépenses d'entretien et de réparation. */
  coutMaintenance: number;
  /** Relevé courant, pour les actifs dont l'entretien suit l'usage. */
  compteur?: number;
  uniteCompteur?: string;
}

export const LIBELLE_TYPE: Record<TypeActif, string> = {
  vehicule: "Véhicule",
  informatique: "Informatique",
  engin: "Engin",
  mobilier: "Mobilier",
};

export const LIBELLE_STATUT: Record<StatutActif, string> = {
  actif: "En service",
  entretien: "En entretien",
  immobilise: "Immobilisé",
  cede: "Cédé",
};

export const ACTIFS: ActifDemo[] = [
  { id: "a1", code: "VEH-001", designation: "Toyota Hilux — 1234 AB 01", type: "vehicule", statut: "actif", affecteA: "Konan Michel", site: "Abidjan", dateAcquisition: "12/03/2023", valeurAcquisition: 18_500_000, coutMaintenance: 1_240_000, compteur: 87_400, uniteCompteur: "km" },
  { id: "a2", code: "VEH-002", designation: "Renault Kangoo — 5678 CD 01", type: "vehicule", statut: "entretien", affecteA: "Touré Mamadou", site: "Abidjan", dateAcquisition: "05/09/2024", valeurAcquisition: 9_800_000, coutMaintenance: 486_000, compteur: 41_200, uniteCompteur: "km" },
  { id: "a3", code: "VEH-003", designation: "Yamaha AG100 — 9012 EF 01", type: "vehicule", statut: "actif", affecteA: "Diomandé Adama", site: "Bouaké", dateAcquisition: "20/01/2025", valeurAcquisition: 1_350_000, coutMaintenance: 128_000, compteur: 18_900, uniteCompteur: "km" },
  { id: "a4", code: "INF-001", designation: "HP ProBook 450 — caisse principale", type: "informatique", statut: "actif", affecteA: "Amani Tatiana", site: "Abidjan", dateAcquisition: "14/06/2024", valeurAcquisition: 685_000, coutMaintenance: 45_000 },
  { id: "a5", code: "INF-002", designation: "Dell OptiPlex — comptabilité", type: "informatique", statut: "actif", affecteA: "Traoré Fatou", site: "Abidjan", dateAcquisition: "05/01/2025", valeurAcquisition: 540_000, coutMaintenance: 0 },
  { id: "a6", code: "INF-003", designation: "Imprimante ticket Epson TM-T20", type: "informatique", statut: "immobilise", site: "Abidjan", dateAcquisition: "14/06/2024", valeurAcquisition: 185_000, coutMaintenance: 62_000 },
  { id: "a7", code: "INF-004", designation: "Tablette Samsung Tab A9 — caisse 2", type: "informatique", statut: "actif", affecteA: "Aya Danielle", site: "Abidjan", dateAcquisition: "02/02/2026", valeurAcquisition: 210_000, coutMaintenance: 0 },
  { id: "a8", code: "ENG-001", designation: "Bétonnière 350 L", type: "engin", statut: "actif", affecteA: "Ouattara Ibrahim", site: "Villa Riviera 3", dateAcquisition: "18/07/2025", valeurAcquisition: 1_150_000, coutMaintenance: 94_000, compteur: 1_240, uniteCompteur: "h" },
  { id: "a9", code: "ENG-002", designation: "Groupe électrogène 15 kVA", type: "engin", statut: "entretien", site: "Immeuble Cocody", dateAcquisition: "03/11/2024", valeurAcquisition: 3_400_000, coutMaintenance: 312_000, compteur: 2_870, uniteCompteur: "h" },
  { id: "a10", code: "MOB-001", designation: "Chambre froide 8 m³", type: "mobilier", statut: "actif", site: "Abidjan", dateAcquisition: "22/05/2023", valeurAcquisition: 4_200_000, coutMaintenance: 580_000 },
];

// ---------------------------------------------------------- interventions

export type NatureIntervention = "preventif" | "correctif" | "controle";

export interface InterventionDemo {
  id: string;
  actif: string;
  nature: NatureIntervention;
  libelle: string;
  date: string;
  prestataire: string;
  cout: number;
  compteur?: number;
  /** Renseigné quand l'actif appartient à un client : l'intervention est facturable. */
  client?: string;
}

export const LIBELLE_NATURE: Record<NatureIntervention, string> = {
  preventif: "Préventif",
  correctif: "Correctif",
  controle: "Contrôle",
};

export const INTERVENTIONS: InterventionDemo[] = [
  { id: "i1", actif: "VEH-002", nature: "correctif", libelle: "Remplacement embrayage", date: "24/08/2026", prestataire: "Garage Adjamé Auto", cout: 385_000, compteur: 41_200 },
  { id: "i2", actif: "ENG-002", nature: "preventif", libelle: "Vidange 250 h", date: "23/08/2026", prestataire: "Atelier interne", cout: 48_000, compteur: 2_870 },
  { id: "i3", actif: "VEH-001", nature: "preventif", libelle: "Vidange et filtres", date: "18/08/2026", prestataire: "Garage Adjamé Auto", cout: 92_000, compteur: 86_800 },
  { id: "i4", actif: "INF-003", nature: "correctif", libelle: "Tête d'impression HS", date: "12/08/2026", prestataire: "Ivoire Informatique", cout: 62_000 },
  { id: "i5", actif: "VEH-001", nature: "controle", libelle: "Visite technique annuelle", date: "04/08/2026", prestataire: "SICTA", cout: 35_000, compteur: 85_100 },
  { id: "i6", actif: "ENG-001", nature: "correctif", libelle: "Réparation moteur électrique", date: "28/07/2026", prestataire: "Atelier interne", cout: 94_000, compteur: 1_180 },
  // Actif appartenant à un client : le garage facture l'intervention.
  { id: "i7", actif: "Client — Peugeot 208, 4455 GH 01", nature: "correctif", libelle: "Distribution complète", date: "22/08/2026", prestataire: "Atelier interne", cout: 420_000, client: "Kouadio Yao" },
  { id: "i8", actif: "Client — Hyundai H1, 7788 IJ 01", nature: "preventif", libelle: "Révision 60 000 km", date: "19/08/2026", prestataire: "Atelier interne", cout: 175_000, client: "Restaurant Akwaba" },
];

// -------------------------------------------------------------- échéances

export type NatureEcheance = "assurance" | "visite" | "garantie" | "entretien";

export interface EcheanceDemo {
  id: string;
  actif: string;
  designation: string;
  nature: NatureEcheance;
  /** Échéance calendaire, ou nulle si l'échéance se déclenche au compteur. */
  date?: string;
  joursRestants?: number;
  /** Seuil de compteur déclenchant l'échéance. */
  compteurCible?: number;
  compteurActuel?: number;
  uniteCompteur?: string;
}

export const LIBELLE_ECHEANCE: Record<NatureEcheance, string> = {
  assurance: "Assurance",
  visite: "Visite technique",
  garantie: "Garantie",
  entretien: "Entretien",
};

export const ECHEANCES: EcheanceDemo[] = [
  { id: "e1", actif: "VEH-003", designation: "Yamaha AG100", nature: "assurance", date: "31/08/2026", joursRestants: 6 },
  { id: "e2", actif: "VEH-002", designation: "Renault Kangoo", nature: "visite", date: "12/09/2026", joursRestants: 18 },
  { id: "e3", actif: "VEH-001", designation: "Toyota Hilux", nature: "entretien", compteurCible: 90_000, compteurActuel: 87_400, uniteCompteur: "km" },
  { id: "e4", actif: "ENG-002", designation: "Groupe électrogène 15 kVA", nature: "entretien", compteurCible: 3_000, compteurActuel: 2_870, uniteCompteur: "h" },
  { id: "e5", actif: "VEH-001", designation: "Toyota Hilux", nature: "assurance", date: "15/11/2026", joursRestants: 82 },
  { id: "e6", actif: "INF-004", designation: "Tablette Samsung Tab A9", nature: "garantie", date: "02/02/2028", joursRestants: 526 },
  { id: "e7", actif: "VEH-003", designation: "Yamaha AG100", nature: "visite", date: "18/08/2026", joursRestants: -7 },
];

/** Une échéance au compteur se juge à ce qu'il reste à parcourir. */
export function resteAvantEcheance(echeance: EcheanceDemo): number | null {
  if (echeance.compteurCible === undefined || echeance.compteurActuel === undefined) {
    return null;
  }
  return echeance.compteurCible - echeance.compteurActuel;
}
