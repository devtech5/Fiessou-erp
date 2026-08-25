/**
 * Jeu de démonstration — stock et gestion commerciale.
 *
 * Provisoire, comme le catalogue : remplacé dès que les modules sont branchés
 * sur la base. Montants en francs CFA entiers.
 */

// ------------------------------------------------------------------- dépôts

export interface DepotDemo {
  id: string;
  code: string;
  nom: string;
  ville: string;
  /**
   * Un seul dépôt par défaut, et c'est le seul statut qui existe.
   * Le concurrent fait cohabiter « Principal » et « Par défaut » sur le même
   * écran, sans que la différence soit définie nulle part.
   */
  parDefaut: boolean;
  articles: number;
  unites: number;
  valeur: number;
}

export const DEPOTS: DepotDemo[] = [
  { id: "d1", code: "DEP-YOP", nom: "Dépôt Yopougon", ville: "Abidjan", parDefaut: true, articles: 263, unites: 24815, valeur: 48750450 },
  { id: "d2", code: "DEP-ADJ", nom: "Dépôt Adjamé", ville: "Abidjan", parDefaut: false, articles: 118, unites: 11276, valeur: 28934780 },
  { id: "d3", code: "MAG-TRE", nom: "Magasin Treichville", ville: "Abidjan", parDefaut: false, articles: 97, unites: 8943, valeur: 19876600 },
  { id: "d4", code: "MAG-BKE", nom: "Magasin Bouaké", ville: "Bouaké", parDefaut: false, articles: 84, unites: 7652, valeur: 12430200 },
];

// -------------------------------------------------------------- mouvements

export type TypeMouvement =
  | "reception"
  | "vente"
  | "transfert"
  | "ajustement"
  | "retour";

export interface MouvementDemo {
  id: string;
  type: TypeMouvement;
  /**
   * Pièce à l'origine du mouvement. Aucun mouvement de stock n'existe sans
   * pièce source : c'est ce qui rend l'inventaire explicable.
   */
  piece: string;
  article: string;
  depot: string;
  depotVers?: string;
  quantite: number;
  motif?: string;
  auteur: string;
  horodatage: string;
}

export const MOUVEMENTS: MouvementDemo[] = [
  { id: "m1", type: "reception", piece: "CMD-2026-0178", article: "Riz parfumé 5 kg", depot: "Dépôt Yopougon", quantite: 500, auteur: "Koffi B.", horodatage: "Aujourd'hui · 10:22" },
  { id: "m2", type: "vente", piece: "TIC-2026-0256", article: "Eau Céleste 33 cl", depot: "Magasin Treichville", quantite: -120, auteur: "Amani T.", horodatage: "Aujourd'hui · 09:15" },
  { id: "m3", type: "transfert", piece: "TRF-2026-0094", article: "Huile Dinor 1 L", depot: "Dépôt Yopougon", depotVers: "Dépôt Adjamé", quantite: -80, auteur: "Sékou D.", horodatage: "Aujourd'hui · 08:40" },
  { id: "m4", type: "ajustement", piece: "INV-2026-0012", article: "Savon Palmida", depot: "Dépôt Adjamé", quantite: -15, motif: "Correction inventaire", auteur: "Aya D.", horodatage: "Aujourd'hui · 08:10" },
  { id: "m5", type: "retour", piece: "AVO-2026-0031", article: "Lait Nido 400 g", depot: "Magasin Treichville", quantite: 6, motif: "Retour client", auteur: "Amani T.", horodatage: "Hier · 17:48" },
  { id: "m6", type: "reception", piece: "CMD-2026-0177", article: "Sucre en morceaux 1 kg", depot: "Dépôt Yopougon", quantite: 240, auteur: "Koffi B.", horodatage: "Hier · 15:02" },
  { id: "m7", type: "vente", piece: "TIC-2026-0249", article: "Coca-Cola 1,5 L", depot: "Magasin Treichville", quantite: -24, auteur: "Aya D.", horodatage: "Hier · 12:31" },
  { id: "m8", type: "transfert", piece: "TRF-2026-0093", article: "Cube Maggi tablette", depot: "Dépôt Adjamé", depotVers: "Magasin Bouaké", quantite: -400, auteur: "Sékou D.", horodatage: "Hier · 09:20" },
];

// ------------------------------------------------------------ réapprovision

export interface AlerteReappro {
  id: string;
  article: string;
  stock: number;
  seuil: number;
  /** Ventes constatées sur les 30 derniers jours. */
  ventes30j: number;
  /** Délai de livraison moyen du fournisseur, en jours. */
  delaiJours: number;
  fournisseur: string;
  prixAchat: number;
}

export const ALERTES: AlerteReappro[] = [
  { id: "r1", article: "Cerelac fruits 250 g", stock: 0, seuil: 20, ventes30j: 320, delaiJours: 3, fournisseur: "Nestlé CI", prixAchat: 1020 },
  { id: "r2", article: "Thé Lipton 25 sachets", stock: 0, seuil: 15, ventes30j: 85, delaiJours: 4, fournisseur: "Unilever CI", prixAchat: 820 },
  { id: "r3", article: "Déodorant Nivea 50 ml", stock: 0, seuil: 10, ventes30j: 42, delaiJours: 6, fournisseur: "Beiersdorf CI", prixAchat: 1650 },
  { id: "r4", article: "Mayonnaise Vinco 250 g", stock: 3, seuil: 15, ventes30j: 60, delaiJours: 4, fournisseur: "Unilever CI", prixAchat: 640 },
  { id: "r5", article: "Éponge vaisselle × 3", stock: 6, seuil: 20, ventes30j: 48, delaiJours: 2, fournisseur: "Sivop", prixAchat: 190 },
  { id: "r6", article: "Gel douche Aqualis Cool 2 L", stock: 9, seuil: 15, ventes30j: 36, delaiJours: 5, fournisseur: "Sivop", prixAchat: 1180 },
  { id: "r7", article: "Couche Babidou taille 6", stock: 4, seuil: 12, ventes30j: 28, delaiJours: 3, fournisseur: "Nestlé CI", prixAchat: 7900 },
  { id: "r8", article: "Attiéké sachet 1 kg", stock: 12, seuil: 25, ventes30j: 190, delaiJours: 1, fournisseur: "Coopérative Anono", prixAchat: 340 },
];

/**
 * Quantité à commander : ce que l'article consommera pendant le délai de
 * livraison, plus une réserve d'un mois, moins ce qui reste en rayon.
 *
 * Arrondi à l'entier supérieur — on ne commande pas un demi-sac.
 */
export function quantiteSuggeree(alerte: AlerteReappro): number {
  const parJour = alerte.ventes30j / 30;
  const besoin = parJour * (alerte.delaiJours + 30);
  return Math.max(alerte.seuil, Math.ceil(besoin - alerte.stock));
}

/** Jours avant rupture au rythme de vente constaté. */
export function joursRestants(alerte: AlerteReappro): number {
  const parJour = alerte.ventes30j / 30;
  if (parJour <= 0) return Infinity;
  return Math.floor(alerte.stock / parJour);
}

// -------------------------------------------------------------------- tiers

export interface ClientDemo {
  id: string;
  nom: string;
  type: "Entreprise" | "Particulier";
  telephone: string;
  email?: string;
  ville: string;
  /** Numéro de Compte Contribuable — l'identifiant fiscal ivoirien. */
  ncc?: string;
  /** Compte auxiliaire client, classe 411 du plan SYSCOHADA. */
  compteAuxiliaire: string;
  encours: number;
  chiffreAffaires: number;
}

export const CLIENTS: ClientDemo[] = [
  { id: "cl1", nom: "Pharmacie du Plateau", type: "Entreprise", telephone: "+225 27 20 31 45 67", email: "contact@pharmaplateau.ci", ville: "Abidjan", ncc: "CI-2019-0042318 A", compteAuxiliaire: "411001", encours: 1125000, chiffreAffaires: 8940000 },
  { id: "cl2", nom: "Maquis Le Baoulé", type: "Entreprise", telephone: "+225 07 08 12 34 56", ville: "Abidjan", ncc: "CI-2021-0118742 K", compteAuxiliaire: "411002", encours: 0, chiffreAffaires: 3420000 },
  { id: "cl3", nom: "Ets Sopé Naby", type: "Entreprise", telephone: "+225 05 44 67 89 01", email: "sopenaby@gmail.com", ville: "Bouaké", ncc: "CI-2018-0077219 M", compteAuxiliaire: "411003", encours: 2750000, chiffreAffaires: 15600000 },
  { id: "cl4", nom: "Kouadio Yao", type: "Particulier", telephone: "+225 01 22 45 78 90", ville: "Abidjan", compteAuxiliaire: "411004", encours: 0, chiffreAffaires: 486000 },
  { id: "cl5", nom: "Restaurant Akwaba", type: "Entreprise", telephone: "+225 27 22 41 55 03", email: "akwaba.resto@gmail.com", ville: "Abidjan", ncc: "CI-2022-0203881 C", compteAuxiliaire: "411005", encours: 875000, chiffreAffaires: 6210000 },
  { id: "cl6", nom: "Quincaillerie Adjamé", type: "Entreprise", telephone: "+225 05 67 23 89 44", ville: "Abidjan", ncc: "CI-2020-0091455 B", compteAuxiliaire: "411006", encours: 340000, chiffreAffaires: 4780000 },
];

export interface FournisseurDemo {
  id: string;
  code: string;
  nom: string;
  categorie: string;
  telephone: string;
  ncc?: string;
  delaiJours: number;
  volumeAchats: number;
  soldeDu: number;
}

export const FOURNISSEURS: FournisseurDemo[] = [
  { id: "f1", code: "F001", nom: "Nestlé CI", categorie: "Alimentaire", telephone: "+225 27 21 75 90 00", ncc: "CI-1985-0000114 N", delaiJours: 3, volumeAchats: 18400000, soldeDu: 2340000 },
  { id: "f2", code: "F002", nom: "Unilever CI", categorie: "Hygiène & Alimentaire", telephone: "+225 27 21 75 44 20", ncc: "CI-1991-0000287 U", delaiJours: 4, volumeAchats: 9760000, soldeDu: 1120000 },
  { id: "f3", code: "F003", nom: "Sivop", categorie: "Hygiène & Beauté", telephone: "+225 27 21 25 33 10", ncc: "CI-1996-0004412 S", delaiJours: 5, volumeAchats: 4230000, soldeDu: 0 },
  { id: "f4", code: "F004", nom: "Beiersdorf CI", categorie: "Hygiène & Beauté", telephone: "+225 27 22 48 11 07", delaiJours: 6, volumeAchats: 2180000, soldeDu: 487640 },
  { id: "f5", code: "F005", nom: "Coopérative Anono", categorie: "Produits frais", telephone: "+225 07 09 33 21 88", delaiJours: 1, volumeAchats: 1560000, soldeDu: 210000 },
];

// ---------------------------------------------------------------- documents

export type StatutDocument =
  | "brouillon"
  | "envoye"
  | "paye"
  | "en_retard"
  | "accepte"
  | "refuse"
  | "converti";

/**
 * Ligne de pièce commerciale.
 *
 * Porte le montant HORS TAXES et son compte d'imputation. C'est ce couple qui
 * permet de générer l'écriture : sans compte sur la ligne, la comptabilité ne
 * saurait pas distinguer une vente de marchandise d'une prestation, et la
 * ventilation par nature de produit serait perdue.
 */
export interface LigneDocument {
  designation: string;
  montantHT: number;
  tauxTVA: number;
  compte: string;
  libelleCompte: string;
}

export interface DocumentDemo {
  id: string;
  numero: string;
  nature: "facture" | "devis" | "avoir";
  client: string;
  /** Compte auxiliaire du client, classe 411. */
  compteAuxiliaire: string;
  date: string;
  echeance?: string;
  statut: StatutDocument;
  lignes: LigneDocument[];
  /** Date de comptabilisation. Absente tant que l'écriture n'est pas passée. */
  comptabiliseLe?: string;
}

const VENTES = { compte: "701", libelle: "Ventes de marchandises" };
const SERVICES = { compte: "706", libelle: "Services vendus" };

/** Raccourci de lisibilité pour une ligne au taux normal. */
function ligne(
  designation: string,
  montantHT: number,
  nature = VENTES,
  tauxTVA = 18,
): LigneDocument {
  return {
    designation,
    montantHT,
    tauxTVA,
    compte: nature.compte,
    libelleCompte: nature.libelle,
  };
}

export const DOCUMENTS: DocumentDemo[] = [
  {
    id: "v1", numero: "FAC-2026-0321", nature: "facture", client: "Ets Sopé Naby",
    compteAuxiliaire: "411003", date: "23/08/2026", echeance: "22/09/2026", statut: "envoye",
    lignes: [
      ligne("Riz parfumé 5 kg × 400", 1_800_000),
      ligne("Huile Dinor 1 L × 200", 500_000),
      ligne("Livraison Bouaké", 30_000, SERVICES),
    ],
  },
  {
    id: "v2", numero: "FAC-2026-0320", nature: "facture", client: "Pharmacie du Plateau",
    compteAuxiliaire: "411001", date: "22/08/2026", echeance: "21/09/2026", statut: "envoye",
    comptabiliseLe: "22/08/2026",
    lignes: [
      ligne("Eau minérale Céleste — palettes", 750_000),
      // Produit alimentaire de base : exonéré. Le taux vit sur la ligne, pas
      // sur le document — une même facture peut mélanger les régimes.
      ligne("Riz local en vrac 500 kg", 260_000, VENTES, 0),
    ],
  },
  {
    id: "v3", numero: "FAC-2026-0319", nature: "facture", client: "Restaurant Akwaba",
    compteAuxiliaire: "411005", date: "21/08/2026", echeance: "05/09/2026", statut: "en_retard",
    comptabiliseLe: "21/08/2026",
    lignes: [
      ligne("Approvisionnement hebdomadaire", 620_000),
      ligne("Prestation de mise en place", 121_000, SERVICES),
    ],
  },
  {
    id: "v4", numero: "FAC-2026-0318", nature: "facture", client: "Maquis Le Baoulé",
    compteAuxiliaire: "411002", date: "20/08/2026", echeance: "19/09/2026", statut: "paye",
    comptabiliseLe: "20/08/2026",
    lignes: [ligne("Boissons et consommables", 542_373)],
  },
  {
    id: "v5", numero: "FAC-2026-0317", nature: "facture", client: "Quincaillerie Adjamé",
    compteAuxiliaire: "411006", date: "19/08/2026", statut: "brouillon",
    lignes: [ligne("Fournitures diverses", 288_136)],
  },
  {
    id: "v6", numero: "DEV-2026-0121", nature: "devis", client: "Restaurant Akwaba",
    compteAuxiliaire: "411005", date: "18/08/2026", statut: "envoye",
    lignes: [ligne("Contrat d'approvisionnement mensuel", 1_254_237)],
  },
  {
    id: "v7", numero: "DEV-2026-0120", nature: "devis", client: "Ets Sopé Naby",
    compteAuxiliaire: "411003", date: "16/08/2026", statut: "converti",
    lignes: [ligne("Commande trimestrielle", 2_711_864)],
  },
  {
    id: "v8", numero: "DEV-2026-0119", nature: "devis", client: "Kouadio Yao",
    compteAuxiliaire: "411004", date: "14/08/2026", statut: "refuse",
    lignes: [ligne("Aménagement boutique", 157_627, SERVICES)],
  },
  {
    id: "v9", numero: "AVO-2026-0031", nature: "avoir", client: "Pharmacie du Plateau",
    compteAuxiliaire: "411001", date: "13/08/2026", statut: "paye",
    comptabiliseLe: "13/08/2026",
    lignes: [ligne("Retour marchandise non conforme", 62_712)],
  },
];

/**
 * Total hors taxes d'une pièce.
 *
 * Calculé depuis les lignes, jamais stocké à côté d'elles : un total conservé
 * en parallèle des lignes qui le composent finit toujours par diverger.
 */
export function totalHT(document: DocumentDemo): number {
  return document.lignes.reduce((somme, l) => somme + l.montantHT, 0);
}

/** Total de la taxe, taux par taux. */
export function totalTVA(document: DocumentDemo): number {
  return document.lignes.reduce(
    (somme, l) => somme + Math.round((l.montantHT * l.tauxTVA) / 100),
    0,
  );
}

/** Ce que le client doit réellement. */
export function totalTTC(document: DocumentDemo): number {
  return totalHT(document) + totalTVA(document);
}

/**
 * Une pièce est comptabilisable si elle engage l'entreprise.
 *
 * Un devis n'engage rien : il ne crée ni créance ni produit tant qu'il n'est
 * pas accepté. Le comptabiliser gonflerait le chiffre d'affaires de propositions
 * qui peuvent être refusées.
 */
export function comptabilisable(document: DocumentDemo): boolean {
  if (document.nature === "devis") return false;
  return document.statut !== "brouillon" && document.statut !== "refuse";
}

export const LIBELLE_STATUT: Record<StatutDocument, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  paye: "Payé",
  en_retard: "En retard",
  accepte: "Accepté",
  refuse: "Refusé",
  converti: "Converti",
};
