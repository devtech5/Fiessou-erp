import type { CodeUnite } from "@/lib/quantite";
import type { MoyenReglementVente } from "@/modules/ventes/schema";

/**
 * Article tel que la caisse le voit.
 *
 * Une projection, pas la ligne de base : la caisse a besoin du prix, de l'unité
 * et du stock du dépôt qui l'approvisionne — pas des comptes comptables ni des
 * délais fournisseurs. C'est aussi ce qui est copié en local pour vendre sans
 * réseau, donc ce qui doit rester petit.
 */
export interface ArticleCaisse {
  id: string;
  sku: string;
  designation: string;
  categorie: string;
  /** Prix TTC d'une unité de vente, en francs entiers. */
  prix: number;
  unite: CodeUnite;
  conditionnement: string;
  /** Stock du dépôt de ce poste, en millièmes. Négatif possible et affiché. */
  stock: number;
  codeBarre?: string;
  /** Une prestation se vend sans stock : le montage, la livraison. */
  service: boolean;
}

export interface PosteCaisseVue {
  id: string;
  code: string;
  nom: string;
  prefixe: string;
  depotNom: string;
  /** Dernier rang connu du serveur : point de départ du compteur local. */
  dernierRang: number;
}

/** Moyens proposés au comptoir, et compte de trésorerie derrière chacun. */
export const MOYENS_CAISSE = [
  { id: "especes", nom: "Espèces", moyen: "especes", demandeReference: false },
  { id: "wave", nom: "Wave", moyen: "mobile_money", demandeReference: true },
  { id: "orange", nom: "Orange Money", moyen: "mobile_money", demandeReference: true },
  { id: "mtn", nom: "MTN MoMo", moyen: "mobile_money", demandeReference: true },
  { id: "moov", nom: "Moov Money", moyen: "mobile_money", demandeReference: true },
  { id: "carte", nom: "Carte bancaire", moyen: "carte", demandeReference: true },
] as const satisfies readonly {
  id: string;
  nom: string;
  moyen: MoyenReglementVente;
  demandeReference: boolean;
}[];

export type MoyenPaiementId = (typeof MOYENS_CAISSE)[number]["id"];

export interface ReglementSaisi {
  moyen: MoyenReglementVente;
  montant: number;
  /**
   * Référence de la transaction. L'opérateur y est repris — « Wave 7XK92 » —
   * parce que la comptabilité regroupe tout le mobile money sur un seul compte
   * et que le rapprochement du relevé exige de savoir chez qui chercher.
   */
  reference?: string;
}
