import { versQuantite, type CodeUnite } from "@/lib/quantite";

/**
 * Jeu de démonstration — supérette d'Abidjan, avec un rayon frais au poids.
 *
 * Provisoire : remplacé par le module Catalogue & Stock dès que la base est en
 * place. Les types définis ici préfigurent les colonnes, pas l'inverse.
 *
 * Les prix sont en francs CFA entiers. Les quantités et les stocks sont en
 * millièmes d'unité de vente — voir `src/lib/quantite.ts`.
 */

export interface ArticleDemo {
  id: string;
  sku: string;
  designation: string;
  categorie: string;
  /** Prix de vente pour UNE unité de vente : la pièce, ou le kilo. */
  prix: number;
  /**
   * Grandeur mesurée. Détermine si l'article se vend en fraction : un poisson
   * au kilo, une bouteille à la pièce.
   */
  unite: CodeUnite;
  /**
   * Libellé du conditionnement, pour l'affichage seulement. « sac », « boîte »,
   * « bouteille » ne sont pas des grandeurs : on ne pèse pas en sacs.
   */
  conditionnement: string;
  /** Stock disponible, en millièmes d'unité. */
  stock: number;
  codeBarre?: string;
}

export const CATEGORIES = [
  "Boissons",
  "Épicerie",
  "Frais",
  "Hygiène & Beauté",
  "Entretien",
  "Boulangerie",
  "Bébé",
] as const;

/** Raccourci de lisibilité : les fixtures se lisent en unités humaines. */
const q = versQuantite;

export const CATALOGUE: ArticleDemo[] = [
  // ------------------------------------------------------------- Boissons
  { id: "a01", sku: "EAU-CEL-150", designation: "Eau minérale Céleste 1,5 L", categorie: "Boissons", prix: 300, unite: "piece", conditionnement: "bouteille", stock: q(148), codeBarre: "6161100010015" },
  { id: "a02", sku: "EAU-CEL-033", designation: "Eau minérale Céleste 33 cl", categorie: "Boissons", prix: 85, unite: "piece", conditionnement: "bouteille", stock: q(420), codeBarre: "6161100010022" },
  { id: "a03", sku: "COCA-150", designation: "Coca-Cola 1,5 L", categorie: "Boissons", prix: 800, unite: "piece", conditionnement: "bouteille", stock: q(62), codeBarre: "5449000000996" },
  { id: "a04", sku: "JUS-FRU-100", designation: "Jus Fruitis orange 1 L", categorie: "Boissons", prix: 1000, unite: "piece", conditionnement: "brique", stock: q(34) },
  { id: "a05", sku: "NESC-050", designation: "Nescafé Classic 50 g", categorie: "Boissons", prix: 1800, unite: "piece", conditionnement: "bocal", stock: q(21) },
  { id: "a06", sku: "LIP-THE-25", designation: "Thé Lipton 25 sachets", categorie: "Boissons", prix: 1100, unite: "piece", conditionnement: "boîte", stock: 0 },

  // ---------------------------------------------------- Frais — au poids
  { id: "a31", sku: "POI-THI-KG", designation: "Thiof frais", categorie: "Frais", prix: 4500, unite: "kg", conditionnement: "vrac", stock: q(12.4) },
  { id: "a32", sku: "POI-MAC-KG", designation: "Maquereau frais", categorie: "Frais", prix: 1800, unite: "kg", conditionnement: "vrac", stock: q(28.75) },
  { id: "a33", sku: "VIA-BOE-KG", designation: "Viande de bœuf", categorie: "Frais", prix: 3200, unite: "kg", conditionnement: "vrac", stock: q(7.2) },
  { id: "a34", sku: "TOM-FRA-KG", designation: "Tomate fraîche", categorie: "Frais", prix: 900, unite: "kg", conditionnement: "vrac", stock: q(4.35) },
  { id: "a35", sku: "OIG-FRA-KG", designation: "Oignon", categorie: "Frais", prix: 700, unite: "kg", conditionnement: "vrac", stock: q(31.5) },
  { id: "a36", sku: "RIZ-VRA-KG", designation: "Riz local en vrac", categorie: "Frais", prix: 650, unite: "kg", conditionnement: "vrac", stock: q(180) },

  // -------------------------------------------------------------- Épicerie
  { id: "a07", sku: "RIZ-PAR-5K", designation: "Riz parfumé 5 kg", categorie: "Épicerie", prix: 4500, unite: "piece", conditionnement: "sac", stock: q(27) },
  { id: "a08", sku: "HUI-DIN-100", designation: "Huile Dinor 1 L", categorie: "Épicerie", prix: 1200, unite: "piece", conditionnement: "bouteille", stock: q(56) },
  { id: "a09", sku: "SUC-MOR-1K", designation: "Sucre en morceaux 1 kg", categorie: "Épicerie", prix: 900, unite: "piece", conditionnement: "paquet", stock: q(73) },
  { id: "a10", sku: "LAIT-NID-400", designation: "Lait Nido 400 g", categorie: "Épicerie", prix: 2800, unite: "piece", conditionnement: "boîte", stock: q(18) },
  { id: "a11", sku: "SAR-TIT-125", designation: "Sardine Titus 125 g", categorie: "Épicerie", prix: 700, unite: "piece", conditionnement: "boîte", stock: q(96) },
  { id: "a12", sku: "TOM-CON-70", designation: "Tomate concentrée 70 g", categorie: "Épicerie", prix: 200, unite: "piece", conditionnement: "boîte", stock: q(210) },
  { id: "a13", sku: "MAG-CUB-TAB", designation: "Cube Maggi tablette", categorie: "Épicerie", prix: 100, unite: "piece", conditionnement: "tablette", stock: q(340) },
  { id: "a14", sku: "SPA-PAN-500", designation: "Spaghetti Panzani 500 g", categorie: "Épicerie", prix: 800, unite: "piece", conditionnement: "paquet", stock: q(44) },
  { id: "a15", sku: "MAY-VIN-250", designation: "Mayonnaise Vinco 250 g", categorie: "Épicerie", prix: 900, unite: "piece", conditionnement: "pot", stock: q(3) },
  { id: "a16", sku: "ATT-SAC-1K", designation: "Attiéké sachet 1 kg", categorie: "Épicerie", prix: 500, unite: "piece", conditionnement: "sachet", stock: q(12) },
  { id: "a17", sku: "SEL-FIN-1K", designation: "Sel fin iodé 1 kg", categorie: "Épicerie", prix: 300, unite: "piece", conditionnement: "paquet", stock: q(88) },

  // ------------------------------------------------------ Hygiène & Beauté
  { id: "a18", sku: "GEL-AQU-2L", designation: "Gel douche Aqualis Cool 2 L", categorie: "Hygiène & Beauté", prix: 1700, unite: "piece", conditionnement: "flacon", stock: q(9) },
  { id: "a19", sku: "SAV-PAL-UNI", designation: "Savon Palmida", categorie: "Hygiène & Beauté", prix: 350, unite: "piece", conditionnement: "pain", stock: q(176) },
  { id: "a20", sku: "DEN-COL-100", designation: "Dentifrice Colgate 100 ml", categorie: "Hygiène & Beauté", prix: 1200, unite: "piece", conditionnement: "tube", stock: q(31) },
  { id: "a21", sku: "PAP-HYG-X4", designation: "Papier hygiénique × 4", categorie: "Hygiène & Beauté", prix: 400, unite: "piece", conditionnement: "lot", stock: q(64) },
  { id: "a22", sku: "DEO-NIV-50", designation: "Déodorant Nivea 50 ml", categorie: "Hygiène & Beauté", prix: 2200, unite: "piece", conditionnement: "flacon", stock: 0 },

  // ------------------------------------------------------------- Entretien
  { id: "a23", sku: "OMO-DET-400", designation: "Détergent Omo 400 g", categorie: "Entretien", prix: 900, unite: "piece", conditionnement: "paquet", stock: q(52) },
  { id: "a24", sku: "JAV-EAU-1L", designation: "Eau de javel 1 L", categorie: "Entretien", prix: 500, unite: "piece", conditionnement: "bouteille", stock: q(41) },
  { id: "a25", sku: "EPO-VAI-X3", designation: "Éponge vaisselle × 3", categorie: "Entretien", prix: 300, unite: "piece", conditionnement: "lot", stock: q(6) },

  // ------------------------------------------------------------ Boulangerie
  { id: "a26", sku: "PAI-BAG-UNI", designation: "Baguette de pain", categorie: "Boulangerie", prix: 200, unite: "piece", conditionnement: "pièce", stock: q(38) },
  { id: "a27", sku: "CRO-BEU-UNI", designation: "Croissant au beurre", categorie: "Boulangerie", prix: 300, unite: "piece", conditionnement: "pièce", stock: q(14) },

  // ------------------------------------------------------------------ Bébé
  { id: "a28", sku: "COU-BAB-N6", designation: "Couche Babidou taille 6", categorie: "Bébé", prix: 10200, unite: "piece", conditionnement: "paquet", stock: q(4) },
  { id: "a29", sku: "CER-FRU-250", designation: "Cerelac fruits 250 g", categorie: "Bébé", prix: 1350, unite: "piece", conditionnement: "boîte", stock: 0 },
  { id: "a30", sku: "BLE-LAI-50", designation: "Blédina blé au lait 50 g", categorie: "Bébé", prix: 350, unite: "piece", conditionnement: "sachet", stock: q(22) },
];

/**
 * Seuil d'alerte, en millièmes.
 *
 * Dix unités pour un article à la pièce, dix kilos pour un article au poids :
 * le seuil s'exprime dans l'unité de l'article, pas en valeur absolue.
 */
export const SEUIL_STOCK_BAS = versQuantite(10);

export interface CaissierDemo {
  id: string;
  nom: string;
}

export const CAISSIERS: CaissierDemo[] = [
  { id: "c1", nom: "Amani Tatiana" },
  { id: "c2", nom: "Koffi Bernard" },
  { id: "c3", nom: "Aya Danielle" },
];

/** Moyens de paiement acceptés en caisse, dans l'ordre d'usage réel. */
export const MOYENS_PAIEMENT = [
  { id: "especes", nom: "Espèces", demandeReference: false },
  { id: "wave", nom: "Wave", demandeReference: true },
  { id: "orange", nom: "Orange Money", demandeReference: true },
  { id: "mtn", nom: "MTN MoMo", demandeReference: true },
  { id: "moov", nom: "Moov Money", demandeReference: true },
  { id: "carte", nom: "Carte bancaire", demandeReference: true },
] as const;

export type MoyenPaiementId = (typeof MOYENS_PAIEMENT)[number]["id"];
