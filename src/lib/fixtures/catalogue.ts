/**
 * Jeu de démonstration — supérette d'Abidjan.
 *
 * Provisoire : remplacé par le module Catalogue & Stock dès que la base est en
 * place. Les types définis ici préfigurent les colonnes, pas l'inverse.
 *
 * Les prix sont en francs CFA entiers, comme partout dans Fiessou.
 * Références et ordres de grandeur repris du marché ivoirien.
 */

export interface ArticleDemo {
  id: string;
  sku: string;
  designation: string;
  categorie: string;
  /** Prix de vente unitaire, en francs entiers. */
  prix: number;
  /** Quantité disponible dans le dépôt qui approvisionne la caisse. */
  stock: number;
  unite: string;
  codeBarre?: string;
}

export const CATEGORIES = [
  "Boissons",
  "Épicerie",
  "Hygiène & Beauté",
  "Entretien",
  "Boulangerie",
  "Bébé",
] as const;

export const CATALOGUE: ArticleDemo[] = [
  // ------------------------------------------------------------- Boissons
  { id: "a01", sku: "EAU-CEL-150", designation: "Eau minérale Céleste 1,5 L", categorie: "Boissons", prix: 300, stock: 148, unite: "bouteille", codeBarre: "6161100010015" },
  { id: "a02", sku: "EAU-CEL-033", designation: "Eau minérale Céleste 33 cl", categorie: "Boissons", prix: 85, stock: 420, unite: "bouteille", codeBarre: "6161100010022" },
  { id: "a03", sku: "COCA-150", designation: "Coca-Cola 1,5 L", categorie: "Boissons", prix: 800, stock: 62, unite: "bouteille", codeBarre: "5449000000996" },
  { id: "a04", sku: "JUS-FRU-100", designation: "Jus Fruitis orange 1 L", categorie: "Boissons", prix: 1000, stock: 34, unite: "brique" },
  { id: "a05", sku: "NESC-050", designation: "Nescafé Classic 50 g", categorie: "Boissons", prix: 1800, stock: 21, unite: "bocal" },
  { id: "a06", sku: "LIP-THE-25", designation: "Thé Lipton 25 sachets", categorie: "Boissons", prix: 1100, stock: 0, unite: "boîte" },

  // -------------------------------------------------------------- Épicerie
  { id: "a07", sku: "RIZ-PAR-5K", designation: "Riz parfumé 5 kg", categorie: "Épicerie", prix: 4500, stock: 27, unite: "sac" },
  { id: "a08", sku: "HUI-DIN-100", designation: "Huile Dinor 1 L", categorie: "Épicerie", prix: 1200, stock: 56, unite: "bouteille" },
  { id: "a09", sku: "SUC-MOR-1K", designation: "Sucre en morceaux 1 kg", categorie: "Épicerie", prix: 900, stock: 73, unite: "paquet" },
  { id: "a10", sku: "LAIT-NID-400", designation: "Lait Nido 400 g", categorie: "Épicerie", prix: 2800, stock: 18, unite: "boîte" },
  { id: "a11", sku: "SAR-TIT-125", designation: "Sardine Titus 125 g", categorie: "Épicerie", prix: 700, stock: 96, unite: "boîte" },
  { id: "a12", sku: "TOM-CON-70", designation: "Tomate concentrée 70 g", categorie: "Épicerie", prix: 200, stock: 210, unite: "boîte" },
  { id: "a13", sku: "MAG-CUB-TAB", designation: "Cube Maggi tablette", categorie: "Épicerie", prix: 100, stock: 340, unite: "tablette" },
  { id: "a14", sku: "SPA-PAN-500", designation: "Spaghetti Panzani 500 g", categorie: "Épicerie", prix: 800, stock: 44, unite: "paquet" },
  { id: "a15", sku: "MAY-VIN-250", designation: "Mayonnaise Vinco 250 g", categorie: "Épicerie", prix: 900, stock: 3, unite: "pot" },
  { id: "a16", sku: "ATT-SAC-1K", designation: "Attiéké sachet 1 kg", categorie: "Épicerie", prix: 500, stock: 12, unite: "sachet" },
  { id: "a17", sku: "SEL-FIN-1K", designation: "Sel fin iodé 1 kg", categorie: "Épicerie", prix: 300, stock: 88, unite: "paquet" },

  // ------------------------------------------------------ Hygiène & Beauté
  { id: "a18", sku: "GEL-AQU-2L", designation: "Gel douche Aqualis Cool 2 L", categorie: "Hygiène & Beauté", prix: 1700, stock: 9, unite: "flacon" },
  { id: "a19", sku: "SAV-PAL-UNI", designation: "Savon Palmida", categorie: "Hygiène & Beauté", prix: 350, stock: 176, unite: "pain" },
  { id: "a20", sku: "DEN-COL-100", designation: "Dentifrice Colgate 100 ml", categorie: "Hygiène & Beauté", prix: 1200, stock: 31, unite: "tube" },
  { id: "a21", sku: "PAP-HYG-X4", designation: "Papier hygiénique × 4", categorie: "Hygiène & Beauté", prix: 400, stock: 64, unite: "lot" },
  { id: "a22", sku: "DEO-NIV-50", designation: "Déodorant Nivea 50 ml", categorie: "Hygiène & Beauté", prix: 2200, stock: 0, unite: "flacon" },

  // ------------------------------------------------------------- Entretien
  { id: "a23", sku: "OMO-DET-400", designation: "Détergent Omo 400 g", categorie: "Entretien", prix: 900, stock: 52, unite: "paquet" },
  { id: "a24", sku: "JAV-EAU-1L", designation: "Eau de javel 1 L", categorie: "Entretien", prix: 500, stock: 41, unite: "bouteille" },
  { id: "a25", sku: "EPO-VAI-X3", designation: "Éponge vaisselle × 3", categorie: "Entretien", prix: 300, stock: 6, unite: "lot" },

  // ------------------------------------------------------------ Boulangerie
  { id: "a26", sku: "PAI-BAG-UNI", designation: "Baguette de pain", categorie: "Boulangerie", prix: 200, stock: 38, unite: "pièce" },
  { id: "a27", sku: "CRO-BEU-UNI", designation: "Croissant au beurre", categorie: "Boulangerie", prix: 300, stock: 14, unite: "pièce" },

  // ------------------------------------------------------------------ Bébé
  { id: "a28", sku: "COU-BAB-N6", designation: "Couche Babidou taille 6", categorie: "Bébé", prix: 10200, stock: 4, unite: "paquet" },
  { id: "a29", sku: "CER-FRU-250", designation: "Cerelac fruits 250 g", categorie: "Bébé", prix: 1350, stock: 0, unite: "boîte" },
  { id: "a30", sku: "BLE-LAI-50", designation: "Blédina blé au lait 50 g", categorie: "Bébé", prix: 350, stock: 22, unite: "sachet" },
];

/** Seuil en dessous duquel un article est signalé comme bas. */
export const SEUIL_STOCK_BAS = 10;

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
