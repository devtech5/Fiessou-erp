/**
 * Jeu de démonstration — documents et signature.
 *
 * Périmètre volontairement resserré. Le concurrent en fait un pilier de son
 * offre : son module contient 208 Ko et six fichiers en démonstration, et
 * embarque un tableur ainsi qu'un traitement de texte reconstruits à la main —
 * des mois d'effort pour concurrencer un logiciel que le client possède déjà.
 *
 * Ici, ce n'est pas un module de stockage mais une PIÈCE JOINTE disponible
 * partout. Sa seule valeur propre est le rattachement : un contrat lié à son
 * client, une pièce justificative liée à son écriture, un permis lié à son
 * conducteur. Un fichier qui ne pointe vers rien n'est qu'un fichier.
 */

/** Entités métier auxquelles un document peut se rattacher. */
export type TypeEntite =
  | "client"
  | "fournisseur"
  | "employe"
  | "intervenant"
  | "contrat"
  | "facture"
  | "actif"
  | "mission"
  | "ecriture";

export const LIBELLE_ENTITE: Record<TypeEntite, string> = {
  client: "Client",
  fournisseur: "Fournisseur",
  employe: "Salarié",
  intervenant: "Intervenant",
  contrat: "Contrat",
  facture: "Facture",
  actif: "Actif",
  mission: "Mission",
  ecriture: "Écriture",
};

export type Visibilite = "prive" | "restreint" | "equipe";

export const LIBELLE_VISIBILITE: Record<Visibilite, string> = {
  prive: "Privé",
  restreint: "Restreint",
  equipe: "Toute l'équipe",
};

export interface DocumentDemo {
  id: string;
  nom: string;
  format: "PDF" | "JPG" | "PNG" | "XLSX" | "DOCX";
  tailleKo: number;
  categorie: string;
  /** Le rattachement : c'est ce qui donne sa valeur au document. */
  entite: TypeEntite;
  entiteLibelle: string;
  visibilite: Visibilite;
  ajoutePar: string;
  date: string;
  /** Échéance propre au document — assurance, agrément, contrat. */
  expireLe?: string;
  joursAvantExpiration?: number;
}

export const DOCUMENTS: DocumentDemo[] = [
  { id: "d1", nom: "Contrat de bail — Résidence Cocody 101", format: "PDF", tailleKo: 842, categorie: "Contrats", entite: "contrat", entiteLibelle: "SEJ-2026-0042", visibilite: "restreint", ajoutePar: "Traoré Fatou", date: "01/08/2026" },
  { id: "d2", nom: "Attestation CNPS — Amani Tatiana", format: "PDF", tailleKo: 156, categorie: "Ressources humaines", entite: "employe", entiteLibelle: "S0002 · Amani Tatiana", visibilite: "prive", ajoutePar: "Traoré Fatou", date: "18/06/2026" },
  { id: "d3", nom: "Carte grise — Toyota Hilux", format: "PDF", tailleKo: 320, categorie: "Parc", entite: "actif", entiteLibelle: "VEH-001", visibilite: "equipe", ajoutePar: "Koffi Bernard", date: "12/03/2023" },
  { id: "d4", nom: "Police d'assurance — Yamaha AG100", format: "PDF", tailleKo: 284, categorie: "Parc", entite: "actif", entiteLibelle: "VEH-003", visibilite: "equipe", ajoutePar: "Koffi Bernard", date: "01/09/2025", expireLe: "31/08/2026", joursAvantExpiration: 6 },
  { id: "d5", nom: "Facture fournisseur — Nestlé CI août", format: "PDF", tailleKo: 198, categorie: "Comptabilité", entite: "ecriture", entiteLibelle: "AC-2026-0186", visibilite: "restreint", ajoutePar: "Traoré Fatou", date: "20/08/2026" },
  { id: "d6", nom: "Bon de livraison signé — Ets Sopé Naby", format: "JPG", tailleKo: 1_240, categorie: "Commercial", entite: "facture", entiteLibelle: "FAC-2026-0321", visibilite: "equipe", ajoutePar: "Konan Michel", date: "23/08/2026" },
  { id: "d7", nom: "Photo de livraison — Cocody Angré", format: "JPG", tailleKo: 2_180, categorie: "Terrain", entite: "mission", entiteLibelle: "LIV-2026-0412", visibilite: "equipe", ajoutePar: "Touré Mamadou", date: "25/08/2026" },
  { id: "d8", nom: "Pièce d'identité — Ouattara Ibrahim", format: "JPG", tailleKo: 680, categorie: "Ressources humaines", entite: "intervenant", entiteLibelle: "Ouattara Ibrahim · Maçon", visibilite: "prive", ajoutePar: "Koffi Bernard", date: "14/07/2026" },
  { id: "d9", nom: "Registre de commerce — Pharmacie du Plateau", format: "PDF", tailleKo: 410, categorie: "Commercial", entite: "client", entiteLibelle: "Pharmacie du Plateau", visibilite: "restreint", ajoutePar: "Koffi Bernard", date: "05/02/2026" },
  { id: "d10", nom: "Agrément fournisseur — Sivop", format: "PDF", tailleKo: 226, categorie: "Achats", entite: "fournisseur", entiteLibelle: "F003 · Sivop", visibilite: "equipe", ajoutePar: "Traoré Fatou", date: "10/01/2026", expireLe: "31/12/2026", joursAvantExpiration: 128 },
  { id: "d11", nom: "Visite technique — Renault Kangoo", format: "PDF", tailleKo: 178, categorie: "Parc", entite: "actif", entiteLibelle: "VEH-002", visibilite: "equipe", ajoutePar: "Konan Michel", date: "12/09/2025", expireLe: "12/09/2026", joursAvantExpiration: 18 },
  { id: "d12", nom: "État des lieux — Sonorisation restituée", format: "PDF", tailleKo: 512, categorie: "Locations", entite: "contrat", entiteLibelle: "LOC-2026-0084", visibilite: "equipe", ajoutePar: "Aya Danielle", date: "17/08/2026" },
];

// ------------------------------------------------------------- signatures

export type StatutSignature =
  | "brouillon"
  | "envoyee"
  | "partielle"
  | "signee"
  | "expiree"
  | "annulee";

export const LIBELLE_SIGNATURE: Record<StatutSignature, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  partielle: "Partiellement signée",
  signee: "Signée",
  expiree: "Expirée",
  annulee: "Annulée",
};

export interface Signataire {
  nom: string;
  /** Interne à l'entreprise, ou tiers extérieur. */
  interne: boolean;
  signeLe?: string;
}

export interface DemandeSignature {
  id: string;
  reference: string;
  document: string;
  statut: StatutSignature;
  signataires: Signataire[];
  cree: string;
  expireLe: string;
  /** Code à six chiffres transmis hors du canal d'envoi. */
  codeSecurite: boolean;
}

export const SIGNATURES: DemandeSignature[] = [
  {
    id: "s1",
    reference: "SIG-2026-0057",
    document: "Contrat de bail — Résidence Cocody 102",
    statut: "partielle",
    cree: "24/08/2026",
    expireLe: "31/08/2026",
    codeSecurite: true,
    signataires: [
      { nom: "Koffi Bernard", interne: true, signeLe: "24/08/2026" },
      { nom: "Silué Fatoumata", interne: false },
    ],
  },
  {
    id: "s2",
    reference: "SIG-2026-0056",
    document: "Contrat de location — Échafaudage LOC-2026-0088",
    statut: "signee",
    cree: "22/08/2026",
    expireLe: "29/08/2026",
    codeSecurite: false,
    signataires: [
      { nom: "Koffi Bernard", interne: true, signeLe: "22/08/2026" },
      { nom: "Quincaillerie Adjamé", interne: false, signeLe: "23/08/2026" },
    ],
  },
  {
    id: "s3",
    reference: "SIG-2026-0055",
    document: "Avenant au contrat de travail — Aya Danielle",
    statut: "envoyee",
    cree: "23/08/2026",
    expireLe: "06/09/2026",
    codeSecurite: true,
    signataires: [
      { nom: "Traoré Fatou", interne: true },
      { nom: "Aya Danielle", interne: true },
    ],
  },
  {
    id: "s4",
    reference: "SIG-2026-0052",
    document: "Devis DEV-2026-0119 — Kouadio Yao",
    statut: "expiree",
    cree: "10/08/2026",
    expireLe: "17/08/2026",
    codeSecurite: false,
    signataires: [
      { nom: "Koffi Bernard", interne: true, signeLe: "10/08/2026" },
      { nom: "Kouadio Yao", interne: false },
    ],
  },
];

/** Une demande est bloquée tant qu'il reste un signataire à relancer. */
export function signatairesManquants(demande: DemandeSignature): number {
  return demande.signataires.filter((s) => !s.signeLe).length;
}
