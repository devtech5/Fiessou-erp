/**
 * Jeu de démonstration — missions et travail de terrain.
 *
 * Un seul moteur porte six entrées du périmètre : livraison, BTP, gestion de
 * projet, collecte de données terrain, exploitation agricole et ONG. Le modèle
 * commun est toujours le même — un travail confié à quelqu'un, découpé en
 * étapes, dont on rapporte la preuve depuis le terrain.
 *
 * C'est le module qui exige le plus le fonctionnement hors connexion : un
 * livreur à Bingerville, un enquêteur en zone rurale ou un chef de chantier
 * dans un sous-sol travaillent sans réseau. Les preuves sont horodatées sur
 * l'appareil et remontent au retour de la couverture.
 */

export type NatureMission =
  | "livraison"
  | "chantier"
  | "collecte"
  | "projet"
  | "intervention";

export type StatutMission =
  | "planifiee"
  | "en_cours"
  | "terminee"
  | "echouee"
  | "annulee";

export type TypePreuve = "photo" | "position" | "signature" | "note" | "formulaire";

export interface EtapeMission {
  libelle: string;
  faite: boolean;
  heure?: string;
  preuves: TypePreuve[];
}

export interface MissionDemo {
  id: string;
  reference: string;
  nature: NatureMission;
  titre: string;
  /** Salarié ou intervenant en charge. */
  assigneA: string;
  lieu: string;
  statut: StatutMission;
  echeance: string;
  etapes: EtapeMission[];
  /** Preuves déjà collectées mais pas encore remontées au serveur. */
  enAttenteSynchro: number;
  /** Client facturé, quand la mission en a un. */
  client?: string;
  montant?: number;
}

export const LIBELLE_NATURE: Record<NatureMission, string> = {
  livraison: "Livraison",
  chantier: "Chantier",
  collecte: "Collecte",
  projet: "Projet",
  intervention: "Intervention",
};

export const LIBELLE_STATUT: Record<StatutMission, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  terminee: "Terminée",
  echouee: "Échouée",
  annulee: "Annulée",
};

export const LIBELLE_PREUVE: Record<TypePreuve, string> = {
  photo: "Photo",
  position: "Position",
  signature: "Signature",
  note: "Note",
  formulaire: "Formulaire",
};

export const MISSIONS: MissionDemo[] = [
  {
    id: "m1",
    reference: "LIV-2026-0412",
    nature: "livraison",
    titre: "Colis — 3 cartons électroménager",
    assigneA: "Touré Mamadou",
    lieu: "Cocody Angré, Abidjan",
    statut: "en_cours",
    echeance: "Aujourd'hui · 16:00",
    client: "Restaurant Akwaba",
    montant: 15_000,
    enAttenteSynchro: 2,
    etapes: [
      { libelle: "Colis collecté au dépôt", faite: true, heure: "09:12", preuves: ["photo", "position"] },
      { libelle: "En transit", faite: true, heure: "09:40", preuves: ["position"] },
      { libelle: "Remis au destinataire", faite: false, preuves: ["photo", "signature", "position"] },
    ],
  },
  {
    id: "m2",
    reference: "LIV-2026-0411",
    nature: "livraison",
    titre: "Déménagement — studio meublé",
    assigneA: "Konan Michel",
    lieu: "Marcory Zone 4, Abidjan",
    statut: "terminee",
    echeance: "Hier · 14:00",
    client: "Kouadio Yao",
    montant: 85_000,
    enAttenteSynchro: 0,
    etapes: [
      { libelle: "Chargement", faite: true, heure: "08:05", preuves: ["photo", "position"] },
      { libelle: "En transit", faite: true, heure: "09:30", preuves: ["position"] },
      { libelle: "Déchargement et remise", faite: true, heure: "11:48", preuves: ["photo", "signature"] },
    ],
  },
  {
    id: "m3",
    reference: "LIV-2026-0410",
    nature: "livraison",
    titre: "Colis — pièces détachées",
    assigneA: "Touré Mamadou",
    lieu: "Bingerville",
    statut: "echouee",
    echeance: "Hier · 17:00",
    client: "Quincaillerie Adjamé",
    montant: 12_000,
    enAttenteSynchro: 0,
    etapes: [
      { libelle: "Colis collecté au dépôt", faite: true, heure: "13:20", preuves: ["photo"] },
      { libelle: "En transit", faite: true, heure: "14:05", preuves: ["position"] },
      { libelle: "Destinataire absent", faite: true, heure: "16:42", preuves: ["photo", "note", "position"] },
    ],
  },
  {
    id: "m4",
    reference: "CHT-2026-0027",
    nature: "chantier",
    titre: "Élévation murs — niveau R+1",
    assigneA: "Ouattara Ibrahim",
    lieu: "Villa Riviera 3, Abidjan",
    statut: "en_cours",
    echeance: "31/08/2026",
    enAttenteSynchro: 5,
    etapes: [
      { libelle: "Matériaux réceptionnés", faite: true, heure: "18/08", preuves: ["photo", "note"] },
      { libelle: "Ferraillage posé", faite: true, heure: "20/08", preuves: ["photo"] },
      { libelle: "Élévation en cours", faite: false, preuves: ["photo"] },
      { libelle: "Réception du lot", faite: false, preuves: ["photo", "signature"] },
    ],
  },
  {
    id: "m5",
    reference: "CHT-2026-0026",
    nature: "chantier",
    titre: "Coffrage dalle — niveau RDC",
    assigneA: "Coulibaly Yaya",
    lieu: "Immeuble Cocody, Abidjan",
    statut: "terminee",
    echeance: "20/08/2026",
    enAttenteSynchro: 0,
    etapes: [
      { libelle: "Coffrage monté", faite: true, heure: "17/08", preuves: ["photo"] },
      { libelle: "Contrôle avant coulage", faite: true, heure: "19/08", preuves: ["photo", "signature"] },
      { libelle: "Réception du lot", faite: true, heure: "20/08", preuves: ["signature"] },
    ],
  },
  {
    id: "m6",
    reference: "COL-2026-0089",
    nature: "collecte",
    titre: "Recensement points de vente — Yamoussoukro",
    assigneA: "Yao Prince",
    lieu: "Yamoussoukro",
    statut: "en_cours",
    echeance: "28/08/2026",
    enAttenteSynchro: 14,
    etapes: [
      { libelle: "Zone 1 — centre", faite: true, heure: "23/08", preuves: ["formulaire", "position", "photo"] },
      { libelle: "Zone 2 — Habitat", faite: true, heure: "24/08", preuves: ["formulaire", "position"] },
      { libelle: "Zone 3 — Kokrenou", faite: false, preuves: ["formulaire", "position"] },
    ],
  },
  {
    id: "m7",
    reference: "PRJ-2026-0008",
    nature: "projet",
    titre: "Ouverture point de vente Bouaké",
    assigneA: "Koffi Bernard",
    lieu: "Bouaké",
    statut: "en_cours",
    echeance: "15/10/2026",
    enAttenteSynchro: 0,
    etapes: [
      { libelle: "Local identifié", faite: true, heure: "02/08", preuves: ["photo", "note"] },
      { libelle: "Bail signé", faite: true, heure: "12/08", preuves: ["signature"] },
      { libelle: "Aménagement", faite: false, preuves: ["photo"] },
      { libelle: "Recrutement équipe", faite: false, preuves: ["note"] },
      { libelle: "Ouverture", faite: false, preuves: ["photo"] },
    ],
  },
  {
    id: "m8",
    reference: "LIV-2026-0413",
    nature: "livraison",
    titre: "Colis — fournitures bureau",
    assigneA: "Konan Michel",
    lieu: "Plateau, Abidjan",
    statut: "planifiee",
    echeance: "Demain · 10:00",
    client: "Pharmacie du Plateau",
    montant: 8_000,
    enAttenteSynchro: 0,
    etapes: [
      { libelle: "Colis collecté au dépôt", faite: false, preuves: ["photo", "position"] },
      { libelle: "En transit", faite: false, preuves: ["position"] },
      { libelle: "Remis au destinataire", faite: false, preuves: ["photo", "signature", "position"] },
    ],
  },
];

/** Avancement d'une mission, en proportion d'étapes achevées. */
export function avancement(mission: MissionDemo): number {
  const faites = mission.etapes.filter((e) => e.faite).length;
  return Math.round((faites / mission.etapes.length) * 100);
}

// ------------------------------------------------------------- formulaires

export type TypeChamp = "texte" | "nombre" | "choix" | "photo" | "position" | "oui_non";

export interface ChampFormulaire {
  libelle: string;
  type: TypeChamp;
  obligatoire: boolean;
}

export interface FormulaireDemo {
  id: string;
  nom: string;
  usage: string;
  champs: ChampFormulaire[];
  /** Réponses déjà collectées et remontées. */
  reponses: number;
  /** Réponses sur des appareils, pas encore synchronisées. */
  enAttente: number;
}

export const LIBELLE_CHAMP: Record<TypeChamp, string> = {
  texte: "Texte",
  nombre: "Nombre",
  choix: "Liste",
  photo: "Photo",
  position: "Position",
  oui_non: "Oui / Non",
};

export const FORMULAIRES: FormulaireDemo[] = [
  {
    id: "f1",
    nom: "Fiche point de vente",
    usage: "Recensement terrain",
    reponses: 126,
    enAttente: 14,
    champs: [
      { libelle: "Enseigne", type: "texte", obligatoire: true },
      { libelle: "Nom du gérant", type: "texte", obligatoire: true },
      { libelle: "Téléphone", type: "texte", obligatoire: true },
      { libelle: "Type de commerce", type: "choix", obligatoire: true },
      { libelle: "Nombre de caisses", type: "nombre", obligatoire: false },
      { libelle: "Devanture", type: "photo", obligatoire: true },
      { libelle: "Coordonnées GPS", type: "position", obligatoire: true },
      { libelle: "Accepte le mobile money", type: "oui_non", obligatoire: false },
    ],
  },
  {
    id: "f2",
    nom: "Constat de livraison",
    usage: "Livraison",
    reponses: 412,
    enAttente: 2,
    champs: [
      { libelle: "État du colis", type: "choix", obligatoire: true },
      { libelle: "Photo à la remise", type: "photo", obligatoire: true },
      { libelle: "Observation", type: "texte", obligatoire: false },
    ],
  },
  {
    id: "f3",
    nom: "Réception de lot",
    usage: "Chantier",
    reponses: 34,
    enAttente: 5,
    champs: [
      { libelle: "Lot réceptionné", type: "texte", obligatoire: true },
      { libelle: "Conforme au plan", type: "oui_non", obligatoire: true },
      { libelle: "Réserves", type: "texte", obligatoire: false },
      { libelle: "Photos", type: "photo", obligatoire: true },
    ],
  },
];
