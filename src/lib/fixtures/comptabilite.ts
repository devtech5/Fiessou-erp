/**
 * Jeu de démonstration — comptabilité SYSCOHADA.
 *
 * Provisoire. Montants en francs CFA entiers.
 */

// ------------------------------------------------------------------ journaux

export interface JournalDemo {
  code: string;
  libelle: string;
  /** Compte de contrepartie déduit automatiquement à la saisie. */
  contrepartie: string;
  ecritures: number;
}

export const JOURNAUX: JournalDemo[] = [
  { code: "VE", libelle: "Ventes", contrepartie: "411 — Clients", ecritures: 412 },
  { code: "AC", libelle: "Achats", contrepartie: "401 — Fournisseurs", ecritures: 186 },
  { code: "CA", libelle: "Caisse", contrepartie: "571 — Caisse", ecritures: 1240 },
  { code: "BQ", libelle: "Banque", contrepartie: "521 — Banques", ecritures: 97 },
  { code: "OD", libelle: "Opérations diverses", contrepartie: "—", ecritures: 34 },
];

// ------------------------------------------------------------ plan comptable

export interface CompteDemo {
  numero: string;
  intitule: string;
  classe: number;
  solde: number;
  sens: "debit" | "credit";
}

export const CLASSES = [
  { numero: 1, intitule: "Ressources durables", comptes: 60 },
  { numero: 2, intitule: "Actif immobilisé", comptes: 68 },
  { numero: 3, intitule: "Stocks", comptes: 38 },
  { numero: 4, intitule: "Tiers", comptes: 110 },
  { numero: 5, intitule: "Trésorerie", comptes: 54 },
  { numero: 6, intitule: "Charges", comptes: 70 },
  { numero: 7, intitule: "Produits", comptes: 46 },
  { numero: 8, intitule: "Autres charges et produits", comptes: 37 },
];

export const COMPTES_CLES: CompteDemo[] = [
  { numero: "401", intitule: "Fournisseurs", classe: 4, solde: 4157640, sens: "credit" },
  { numero: "411", intitule: "Clients", classe: 4, solde: 5090000, sens: "debit" },
  { numero: "521", intitule: "Banques", classe: 5, solde: 12480300, sens: "debit" },
  { numero: "571", intitule: "Caisse", classe: 5, solde: 1842500, sens: "debit" },
  { numero: "5711", intitule: "Caisse Mobile Money", classe: 5, solde: 936400, sens: "debit" },
  { numero: "4431", intitule: "TVA facturée", classe: 4, solde: 3348000, sens: "credit" },
  { numero: "4451", intitule: "TVA récupérable", classe: 4, solde: 1971000, sens: "debit" },
];

// -------------------------------------------------------- soldes de gestion

/**
 * Éléments du compte de résultat, en cascade SYSCOHADA.
 *
 * Le concurrent affiche une valeur ajoutée strictement égale à son excédent
 * brut d'exploitation, et un résultat d'exploitation égal au résultat net.
 * C'est arithmétiquement impossible dès qu'il y a un salarié ou un impôt : la
 * cascade n'est pas calculée chez eux, les cases sont remplies avec la même
 * valeur. Ici chaque solde découle du précédent.
 */
export const ELEMENTS_RESULTAT = {
  ventesMarchandises: 74_200_000,
  achatsMarchandises: 48_600_000,
  variationStocks: 1_240_000,
  servicesExterieurs: 6_180_000,
  impotsEtTaxes: 1_450_000,
  chargesPersonnel: 9_840_000,
  autresCharges: 620_000,
  dotationsAmortissements: 2_310_000,
  produitsFinanciers: 180_000,
  chargesFinancieres: 940_000,
  hao: -320_000,
  impotSurResultat: 1_260_000,
};

export interface SoldeGestion {
  code: string;
  libelle: string;
  montant: number;
  /** Un solde intermédiaire est mis en avant, un détail ne l'est pas. */
  cle?: boolean;
}

/**
 * Construit la cascade. Chaque ligne s'obtient à partir de la précédente,
 * jamais recopiée.
 */
export function calculerSIG(): SoldeGestion[] {
  const e = ELEMENTS_RESULTAT;

  const margeCommerciale =
    e.ventesMarchandises - e.achatsMarchandises + e.variationStocks;
  const valeurAjoutee = margeCommerciale - e.servicesExterieurs;
  const excedentBrut = valeurAjoutee - e.impotsEtTaxes - e.chargesPersonnel;
  const resultatExploitation =
    excedentBrut - e.autresCharges - e.dotationsAmortissements;
  const resultatFinancier = e.produitsFinanciers - e.chargesFinancieres;
  const resultatOrdinaire = resultatExploitation + resultatFinancier;
  const resultatNet = resultatOrdinaire + e.hao - e.impotSurResultat;

  return [
    { code: "TA", libelle: "Ventes de marchandises", montant: e.ventesMarchandises },
    { code: "RA", libelle: "Achats de marchandises", montant: -e.achatsMarchandises },
    { code: "RB", libelle: "Variation de stocks", montant: e.variationStocks },
    { code: "XA", libelle: "Marge commerciale", montant: margeCommerciale, cle: true },
    { code: "RC", libelle: "Services extérieurs", montant: -e.servicesExterieurs },
    { code: "XB", libelle: "Valeur ajoutée", montant: valeurAjoutee, cle: true },
    { code: "RD", libelle: "Impôts et taxes", montant: -e.impotsEtTaxes },
    { code: "RE", libelle: "Charges de personnel", montant: -e.chargesPersonnel },
    { code: "XC", libelle: "Excédent brut d'exploitation", montant: excedentBrut, cle: true },
    { code: "RF", libelle: "Autres charges", montant: -e.autresCharges },
    { code: "RG", libelle: "Dotations aux amortissements", montant: -e.dotationsAmortissements },
    { code: "XD", libelle: "Résultat d'exploitation", montant: resultatExploitation, cle: true },
    { code: "XE", libelle: "Résultat financier", montant: resultatFinancier, cle: true },
    { code: "XF", libelle: "Résultat des activités ordinaires", montant: resultatOrdinaire, cle: true },
    { code: "XG", libelle: "Résultat hors activités ordinaires", montant: e.hao },
    { code: "RH", libelle: "Impôt sur le résultat", montant: -e.impotSurResultat },
    { code: "XI", libelle: "Résultat net", montant: resultatNet, cle: true },
  ];
}

// -------------------------------------------------------------- obligations

export interface ObligationFiscale {
  id: string;
  libelle: string;
  /** Administration destinataire. En Côte d'Ivoire : la DGI. */
  administration: string;
  periode: string;
  echeance: string;
  montant: number;
  statut: "a_declarer" | "declaree" | "payee" | "en_retard";
}

export const OBLIGATIONS: ObligationFiscale[] = [
  { id: "o1", libelle: "TVA", administration: "DGI", periode: "Juillet 2026", echeance: "15/08/2026", montant: 1377000, statut: "payee" },
  { id: "o2", libelle: "ITS — retenues sur salaires", administration: "DGI", periode: "Juillet 2026", echeance: "15/08/2026", montant: 486300, statut: "payee" },
  { id: "o3", libelle: "Cotisations CNPS", administration: "CNPS", periode: "Juillet 2026", echeance: "15/08/2026", montant: 1284500, statut: "declaree" },
  { id: "o4", libelle: "TVA", administration: "DGI", periode: "Août 2026", echeance: "15/09/2026", montant: 1971000, statut: "a_declarer" },
  { id: "o5", libelle: "Acompte BIC", administration: "DGI", periode: "3e trimestre 2026", echeance: "15/09/2026", montant: 840000, statut: "a_declarer" },
  { id: "o6", libelle: "Patente", administration: "DGI", periode: "Exercice 2026", echeance: "31/07/2026", montant: 312000, statut: "en_retard" },
];

export const LIBELLE_OBLIGATION = {
  a_declarer: "À déclarer",
  declaree: "Déclarée",
  payee: "Payée",
  en_retard: "En retard",
} as const;

// ---------------------------------------------------------- clôture guidée

export interface EtapeCloture {
  numero: number;
  libelle: string;
  fait: boolean;
  bloquant: boolean;
}

export const ETAPES_CLOTURE: EtapeCloture[] = [
  { numero: 1, libelle: "Tous les journaux sont saisis", fait: true, bloquant: true },
  { numero: 2, libelle: "Rapprochement bancaire à jour", fait: true, bloquant: true },
  { numero: 3, libelle: "Comptes de tiers lettrés", fait: false, bloquant: false },
  { numero: 4, libelle: "Inventaire physique valorisé", fait: false, bloquant: true },
  { numero: 5, libelle: "Amortissements calculés", fait: false, bloquant: true },
  { numero: 6, libelle: "Provisions constatées", fait: false, bloquant: false },
  { numero: 7, libelle: "Charges et produits rattachés à l'exercice", fait: false, bloquant: true },
  { numero: 8, libelle: "Balance équilibrée", fait: false, bloquant: true },
  { numero: 9, libelle: "États financiers générés", fait: false, bloquant: true },
  { numero: 10, libelle: "Report à nouveau calculé", fait: false, bloquant: true },
];

// ------------------------------------------------------------------ lettrage

export const LETTRAGE = {
  compte: "411 — Clients",
  nonLettrees: 34,
  lettrees: 296,
  soldeDebitNonLettre: 5090000,
  soldeCreditNonLettre: 74000,
  suggestions: 12,
};
