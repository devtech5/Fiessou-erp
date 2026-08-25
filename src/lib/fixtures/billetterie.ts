/**
 * Jeu de démonstration — billetterie de transport.
 *
 * À ne pas confondre avec la livraison, qui figurait juste à côté dans le
 * périmètre. La billetterie réserve UNE PLACE SUR UN DÉPART PROGRAMMÉ ; la
 * livraison suit UN OBJET d'un point à un autre. Deux moteurs distincts : ici,
 * la ressource est un siège qui n'existe qu'à une date et une heure données, et
 * qui disparaît au départ du véhicule.
 */

export interface LigneDemo {
  id: string;
  code: string;
  depart: string;
  arrivee: string;
  /** Durée annoncée du trajet, en minutes. */
  duree: number;
  distanceKm: number;
  tarif: number;
}

export const LIGNES: LigneDemo[] = [
  { id: "l1", code: "ABJ-BKE", depart: "Abidjan", arrivee: "Bouaké", duree: 300, distanceKm: 350, tarif: 6_000 },
  { id: "l2", code: "ABJ-YAM", depart: "Abidjan", arrivee: "Yamoussoukro", duree: 210, distanceKm: 240, tarif: 4_500 },
  { id: "l3", code: "ABJ-SPD", depart: "Abidjan", arrivee: "San Pedro", duree: 360, distanceKm: 350, tarif: 7_000 },
  { id: "l4", code: "ABJ-KOR", depart: "Abidjan", arrivee: "Korhogo", duree: 600, distanceKm: 630, tarif: 12_000 },
  { id: "l5", code: "ABJ-MAN", depart: "Abidjan", arrivee: "Man", duree: 480, distanceKm: 570, tarif: 10_000 },
  { id: "l6", code: "ABJ-DAL", depart: "Abidjan", arrivee: "Daloa", duree: 330, distanceKm: 380, tarif: 7_500 },
];

// ----------------------------------------------------------------- départs

export type StatutDepart = "ouvert" | "complet" | "embarquement" | "parti" | "annule";

export interface DepartDemo {
  id: string;
  reference: string;
  ligne: LigneDemo;
  date: string;
  heure: string;
  vehicule: string;
  /** Rangées de quatre sièges, disposition 2 + couloir + 2. */
  rangees: number;
  statut: StatutDepart;
  /** Sièges déjà vendus, en notation « rangée + lettre ». */
  siegesVendus: string[];
}

export const LIBELLE_DEPART: Record<StatutDepart, string> = {
  ouvert: "Ouvert",
  complet: "Complet",
  embarquement: "Embarquement",
  parti: "Parti",
  annule: "Annulé",
};

/** Lettres de siège dans une rangée : A et B à gauche, C et D à droite. */
export const LETTRES_SIEGE = ["A", "B", "C", "D"] as const;

/** Construit une liste de sièges occupés, pour la démonstration. */
function sieges(...refs: string[]): string[] {
  return refs;
}

export const DEPARTS: DepartDemo[] = [
  {
    id: "d1",
    reference: "DEP-2026-1184",
    ligne: LIGNES[0],
    date: "25/08/2026",
    heure: "07:00",
    vehicule: "Car 60 — 4521 AB 01",
    rangees: 15,
    statut: "parti",
    siegesVendus: sieges(
      "1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D", "3A", "3B", "3C",
      "4A", "4B", "4C", "4D", "5A", "5B", "6A", "6B", "6C", "6D",
      "7A", "7C", "8A", "8B", "8C", "8D", "9A", "9B", "10A", "10B",
      "10C", "11A", "11B", "12A", "12C", "13A", "13B", "14A", "15A",
    ),
  },
  {
    id: "d2",
    reference: "DEP-2026-1185",
    ligne: LIGNES[1],
    date: "25/08/2026",
    heure: "14:30",
    vehicule: "Minibus 32 — 7788 CD 01",
    rangees: 8,
    statut: "embarquement",
    siegesVendus: sieges(
      "1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D", "3A", "3B", "3C", "3D",
      "4A", "4B", "4C", "4D", "5A", "5B", "5C", "5D", "6A", "6B", "6C",
      "7A", "7B", "8A",
    ),
  },
  {
    id: "d3",
    reference: "DEP-2026-1186",
    ligne: LIGNES[0],
    date: "25/08/2026",
    heure: "16:00",
    vehicule: "Car 60 — 4522 AB 01",
    rangees: 15,
    statut: "ouvert",
    siegesVendus: sieges(
      "1A", "1B", "2A", "2C", "3B", "3D", "4A", "4B", "4C",
      "6A", "6D", "7B", "8A", "8B", "9C", "10A", "11B", "12A", "12B",
    ),
  },
  {
    id: "d4",
    reference: "DEP-2026-1187",
    ligne: LIGNES[3],
    date: "25/08/2026",
    heure: "18:00",
    vehicule: "Car 60 — 4523 AB 01",
    rangees: 15,
    statut: "ouvert",
    siegesVendus: sieges("1A", "1B", "1C", "2A", "2B", "5A", "5B", "9A", "9B"),
  },
  {
    id: "d5",
    reference: "DEP-2026-1188",
    ligne: LIGNES[2],
    date: "26/08/2026",
    heure: "06:30",
    vehicule: "Car 60 — 4521 AB 01",
    rangees: 15,
    statut: "ouvert",
    siegesVendus: sieges("1A", "1B", "3C", "3D", "7A"),
  },
  {
    id: "d6",
    reference: "DEP-2026-1189",
    ligne: LIGNES[4],
    date: "26/08/2026",
    heure: "07:30",
    vehicule: "Minibus 32 — 7789 CD 01",
    rangees: 8,
    statut: "ouvert",
    siegesVendus: sieges("1A", "1B", "1C", "1D", "2A", "2B"),
  },
];

/** Nombre total de places d'un départ. */
export function capacite(depart: DepartDemo): number {
  return depart.rangees * LETTRES_SIEGE.length;
}

export function placesLibres(depart: DepartDemo): number {
  return capacite(depart) - depart.siegesVendus.length;
}

export function tauxRemplissage(depart: DepartDemo): number {
  return Math.round((depart.siegesVendus.length / capacite(depart)) * 100);
}

/** Recette d'un départ : places vendues au tarif de la ligne. */
export function recette(depart: DepartDemo): number {
  return depart.siegesVendus.length * depart.ligne.tarif;
}

// ----------------------------------------------------------------- billets

export type StatutBillet = "valide" | "embarque" | "annule" | "non_presente";

export interface BilletDemo {
  id: string;
  numero: string;
  depart: string;
  ligne: string;
  siege: string;
  passager: string;
  telephone: string;
  /** Pièce d'identité relevée à la vente, exigée au contrôle. */
  piece?: string;
  montant: number;
  statut: StatutBillet;
  canal: "guichet" | "en_ligne";
}

export const LIBELLE_BILLET: Record<StatutBillet, string> = {
  valide: "Valide",
  embarque: "Embarqué",
  annule: "Annulé",
  non_presente: "Non présenté",
};

export const BILLETS: BilletDemo[] = [
  { id: "b1", numero: "BIL-2026-04412", depart: "DEP-2026-1185", ligne: "Abidjan → Yamoussoukro", siege: "3C", passager: "Kouassi Ange", telephone: "07 88 45 12 33", piece: "CI 0234519", montant: 4_500, statut: "embarque", canal: "guichet" },
  { id: "b2", numero: "BIL-2026-04413", depart: "DEP-2026-1185", ligne: "Abidjan → Yamoussoukro", siege: "3D", passager: "Kouassi Adjoua", telephone: "07 88 45 12 33", montant: 4_500, statut: "embarque", canal: "guichet" },
  { id: "b3", numero: "BIL-2026-04414", depart: "DEP-2026-1185", ligne: "Abidjan → Yamoussoukro", siege: "7B", passager: "N'Dri Serge", telephone: "05 66 21 08 74", piece: "CI 0119873", montant: 4_500, statut: "valide", canal: "en_ligne" },
  { id: "b4", numero: "BIL-2026-04415", depart: "DEP-2026-1186", ligne: "Abidjan → Bouaké", siege: "4A", passager: "Bamba Awa", telephone: "01 44 78 90 12", piece: "CI 0788412", montant: 6_000, statut: "valide", canal: "en_ligne" },
  { id: "b5", numero: "BIL-2026-04416", depart: "DEP-2026-1186", ligne: "Abidjan → Bouaké", siege: "4B", passager: "Bamba Ismaël", telephone: "01 44 78 90 12", montant: 6_000, statut: "valide", canal: "en_ligne" },
  { id: "b6", numero: "BIL-2026-04417", depart: "DEP-2026-1187", ligne: "Abidjan → Korhogo", siege: "1A", passager: "Silué Fatoumata", telephone: "07 33 21 65 09", piece: "CI 0445612", montant: 12_000, statut: "valide", canal: "guichet" },
  { id: "b7", numero: "BIL-2026-04409", depart: "DEP-2026-1184", ligne: "Abidjan → Bouaké", siege: "12C", passager: "Yao Emmanuel", telephone: "05 90 12 34 56", montant: 6_000, statut: "non_presente", canal: "guichet" },
  { id: "b8", numero: "BIL-2026-04410", depart: "DEP-2026-1184", ligne: "Abidjan → Bouaké", siege: "7C", passager: "Diarra Mariam", telephone: "07 55 44 33 22", piece: "CI 0902334", montant: 6_000, statut: "embarque", canal: "en_ligne" },
  { id: "b9", numero: "BIL-2026-04418", depart: "DEP-2026-1188", ligne: "Abidjan → San Pedro", siege: "3C", passager: "Koffi Rodrigue", telephone: "01 77 88 99 00", montant: 7_000, statut: "annule", canal: "en_ligne" },
];

/** Durée d'un trajet en heures et minutes. */
export function formaterDuree(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${reste}`;
}
