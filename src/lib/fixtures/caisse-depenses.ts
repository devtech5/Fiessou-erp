/**
 * Jeu de démonstration — caisse de dépenses et bons de décaissement.
 *
 * À ne pas confondre avec la caisse du point de vente. Celle-ci encaisse les
 * ventes ; la caisse de dépenses est une réserve d'espèces alimentée par des
 * remises de fonds, d'où sortent les achats urgents, les frais de mission et
 * les avances. Deux caisses, deux comptes, deux clôtures.
 */

import type { EtapeCircuit, Personne } from "@/lib/approbation/circuit";

// ------------------------------------------------------------- l'annuaire

export const ANNUAIRE: Personne[] = [
  { id: "p1", nom: "Koffi Bernard", fonction: "Gérant", superieurId: null, direction: true },
  { id: "p2", nom: "Kouassi Marcel", fonction: "Directeur associé", superieurId: null, direction: true },
  { id: "p3", nom: "Traoré Fatou", fonction: "Comptable", superieurId: "p1", direction: false },
  { id: "p4", nom: "Sékou Diarra", fonction: "Magasinier", superieurId: "p1", direction: false },
  { id: "p5", nom: "Konan Michel", fonction: "Livreur", superieurId: "p4", direction: false },
  { id: "p6", nom: "Amani Tatiana", fonction: "Caissière", superieurId: "p3", direction: false },
  { id: "p7", nom: "Aya Danielle", fonction: "Caissière", superieurId: "p3", direction: false },
];

export function personne(id: string): Personne {
  return ANNUAIRE.find((p) => p.id === id)!;
}

// --------------------------------------------------------------- caisses

export interface CaisseDepenses {
  id: string;
  code: string;
  nom: string;
  /** Compte SYSCOHADA rattaché, distinct de celui du point de vente. */
  compte: string;
  responsable: string;
  solde: number;
  /** Seuil sous lequel la caisse doit être réalimentée. */
  seuilAlerte: number;
}

export const CAISSES: CaisseDepenses[] = [
  { id: "k1", code: "CAI-SIEGE", nom: "Caisse centrale — siège", compte: "5711", responsable: "Traoré Fatou", solde: 485_000, seuilAlerte: 150_000 },
  { id: "k2", code: "CAI-BKE", nom: "Caisse Bouaké", compte: "5712", responsable: "Aya Danielle", solde: 92_000, seuilAlerte: 100_000 },
];

// ----------------------------------------------------------- bons de caisse

export type NatureDepense =
  | "achat"
  | "transport"
  | "mission"
  | "avance"
  | "entretien"
  | "divers";

export const LIBELLE_NATURE: Record<NatureDepense, string> = {
  achat: "Achat",
  transport: "Transport",
  mission: "Frais de mission",
  avance: "Avance",
  entretien: "Entretien",
  divers: "Divers",
};

export interface BonCaisse {
  id: string;
  numero: string;
  emetteurId: string;
  caisseId: string;
  nature: NatureDepense;
  objet: string;
  montant: number;
  dateDemande: string;
  circuit: EtapeCircuit[];
  /** Renseigné une fois l'argent réellement remis. */
  decaisseLe?: string;
  decaissePar?: string;
  /** Montant du justificatif rapporté. Nul tant qu'il n'est pas fourni. */
  justificatif?: number;
  annule?: boolean;
}

export const BONS: BonCaisse[] = [
  {
    id: "b1",
    numero: "BC-2026-0142",
    emetteurId: "p4",
    caisseId: "k1",
    nature: "transport",
    objet: "Carburant — livraisons Abidjan",
    montant: 35_000,
    dateDemande: "24/08/2026",
    circuit: [
      { role: "superieur", valideurId: "p1", valideurNom: "Koffi Bernard", decision: "approuve", parNom: "Koffi Bernard", le: "24/08/2026" },
    ],
    decaisseLe: "24/08/2026",
    decaissePar: "Traoré Fatou",
    justificatif: 35_000,
  },
  {
    id: "b2",
    numero: "BC-2026-0143",
    emetteurId: "p3",
    caisseId: "k1",
    nature: "achat",
    objet: "Acompte fournisseur — Coopérative Anono",
    montant: 180_000,
    dateDemande: "25/08/2026",
    circuit: [
      { role: "superieur", valideurId: "p1", valideurNom: "Koffi Bernard", decision: "approuve", parNom: "Koffi Bernard", le: "25/08/2026" },
      { role: "direction", valideurId: "p2", valideurNom: "Direction" },
    ],
  },
  {
    id: "b3",
    numero: "BC-2026-0144",
    emetteurId: "p5",
    caisseId: "k1",
    nature: "mission",
    objet: "Frais de déplacement — Bingerville",
    montant: 15_000,
    dateDemande: "25/08/2026",
    circuit: [
      { role: "superieur", valideurId: "p4", valideurNom: "Sékou Diarra", decision: "approuve", parNom: "Sékou Diarra", le: "25/08/2026" },
    ],
  },
  {
    id: "b4",
    numero: "BC-2026-0145",
    emetteurId: "p1",
    caisseId: "k1",
    nature: "divers",
    objet: "Frais de représentation — rencontre partenaires",
    montant: 250_000,
    dateDemande: "25/08/2026",
    // Le gérant n'a pas de supérieur : son bon part directement en direction,
    // et c'est l'autre dirigeant qui tranche. Jamais lui-même.
    circuit: [
      { role: "direction", valideurId: "p2", valideurNom: "Kouassi Marcel" },
    ],
  },
  {
    id: "b5",
    numero: "BC-2026-0146",
    emetteurId: "p6",
    caisseId: "k1",
    nature: "divers",
    objet: "Achat ventilateur — poste de caisse",
    montant: 45_000,
    dateDemande: "23/08/2026",
    circuit: [
      {
        role: "superieur",
        valideurId: "p3",
        valideurNom: "Traoré Fatou",
        decision: "refuse",
        parNom: "Traoré Fatou",
        le: "23/08/2026",
        motif: "À passer en immobilisation, pas en caisse. Faire une demande d'achat.",
      },
    ],
  },
  {
    id: "b6",
    numero: "BC-2026-0141",
    emetteurId: "p4",
    caisseId: "k1",
    nature: "avance",
    objet: "Avance achat pièces — quincaillerie",
    montant: 120_000,
    dateDemande: "22/08/2026",
    circuit: [
      { role: "superieur", valideurId: "p1", valideurNom: "Koffi Bernard", decision: "approuve", parNom: "Koffi Bernard", le: "22/08/2026" },
      { role: "direction", valideurId: "p2", valideurNom: "Kouassi Marcel", decision: "approuve", parNom: "Kouassi Marcel", le: "22/08/2026" },
    ],
    decaisseLe: "22/08/2026",
    decaissePar: "Traoré Fatou",
    justificatif: 113_400,
  },
  {
    id: "b7",
    numero: "BC-2026-0140",
    emetteurId: "p7",
    caisseId: "k2",
    nature: "achat",
    objet: "Fournitures de bureau — agence Bouaké",
    montant: 28_000,
    dateDemande: "20/08/2026",
    circuit: [
      { role: "superieur", valideurId: "p3", valideurNom: "Traoré Fatou", decision: "approuve", parNom: "Traoré Fatou", le: "20/08/2026" },
    ],
    decaisseLe: "21/08/2026",
    decaissePar: "Aya Danielle",
    // Décaissé il y a plusieurs jours, toujours sans justificatif.
  },
];

/**
 * Reliquat d'une avance : ce qui a été remis, moins ce que le justificatif
 * prouve. Positif, l'employé doit rendre la différence.
 *
 * Sans ce suivi, les avances non soldées s'accumulent et finissent par
 * disparaître dans le solde de caisse sans que personne ne sache à qui les
 * réclamer.
 */
export function reliquat(bon: BonCaisse): number | null {
  if (!bon.decaisseLe) return null;
  if (bon.justificatif === undefined) return bon.montant;
  return bon.montant - bon.justificatif;
}

/** Un bon décaissé sans justificatif rapporté reste à régulariser. */
export function aRegulariser(bon: BonCaisse): boolean {
  return Boolean(bon.decaisseLe) && bon.justificatif === undefined;
}

export function caisse(id: string): CaisseDepenses {
  return CAISSES.find((c) => c.id === id)!;
}
