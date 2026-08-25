/**
 * Jeu de démonstration — personnel et rémunération.
 *
 * ⚠️ Les taux ci-dessous servent à faire tourner l'écran de démonstration.
 * Ils DOIVENT être vérifiés auprès de la CNPS et de la DGI, et confrontés à
 * des bulletins réels, avant toute mise en production. Un barème approximatif
 * dans un moteur de paie est une faute, pas un détail : le concurrent affiche
 * des taux sénégalais — IPRES, CSS — sur ses écrans vendus en Côte d'Ivoire.
 *
 * Ce qui compte à ce stade, et qui est vrai ici : la cascade de calcul est
 * juste. Net = brut − cotisations salariales − impôt. Leur propre capture
 * marketing affiche un net supérieur au brut sur chaque ligne.
 */

export const BAREME_CI = {
  /** Retraite CNPS — part salariale. */
  cnpsRetraiteSalarie: 6.3,
  /** Retraite CNPS — part patronale. */
  cnpsRetraitePatronal: 7.7,
  /** Plafond mensuel de cotisation retraite. */
  cnpsPlafondMensuel: 3_375_000,
  /** Prestations familiales — entièrement patronal. */
  prestationsFamiliales: 5.75,
  /** Accident du travail — patronal, variable selon le risque de l'activité. */
  accidentTravail: 2,
  aVerifier: true,
} as const;

// ------------------------------------------------------------------ salariés

export type TypeContrat = "CDI" | "CDD" | "Stage" | "Essai";

export interface EmployeDemo {
  id: string;
  matricule: string;
  nom: string;
  poste: string;
  contrat: TypeContrat;
  debut: string;
  /** Nul pour un contrat à durée indéterminée. */
  fin?: string;
  salaireBase: number;
  numeroCnps?: string;
}

export const EMPLOYES: EmployeDemo[] = [
  { id: "e1", matricule: "S0001", nom: "Koffi Bernard", poste: "Gérant", contrat: "CDI", debut: "01/03/2023", salaireBase: 450000, numeroCnps: "0123456789" },
  { id: "e2", matricule: "S0002", nom: "Amani Tatiana", poste: "Caissière", contrat: "CDI", debut: "15/06/2024", salaireBase: 180000, numeroCnps: "0123456790" },
  { id: "e3", matricule: "S0003", nom: "Aya Danielle", poste: "Caissière", contrat: "CDD", debut: "01/02/2026", fin: "31/08/2026", salaireBase: 165000, numeroCnps: "0123456791" },
  { id: "e4", matricule: "S0004", nom: "Sékou Diarra", poste: "Magasinier", contrat: "CDI", debut: "10/09/2024", salaireBase: 210000, numeroCnps: "0123456792" },
  { id: "e5", matricule: "S0005", nom: "Konan Michel", poste: "Livreur", contrat: "CDD", debut: "01/04/2026", fin: "30/09/2026", salaireBase: 155000, numeroCnps: "0123456793" },
  { id: "e6", matricule: "S0006", nom: "Traoré Fatou", poste: "Comptable", contrat: "CDI", debut: "05/01/2025", salaireBase: 320000, numeroCnps: "0123456794" },
  { id: "e7", matricule: "S0007", nom: "Yao Prince", poste: "Stagiaire", contrat: "Stage", debut: "01/07/2026", fin: "30/09/2026", salaireBase: 75000 },
];

export interface Bulletin {
  employe: EmployeDemo;
  brut: number;
  cotisationsSalariales: number;
  impot: number;
  net: number;
  chargesPatronales: number;
  /** Ce que l'employeur débourse réellement. */
  coutTotal: number;
}

/** Barème ITS simplifié pour la démonstration. À remplacer par le barème réel. */
function impotSurSalaire(base: number): number {
  if (base <= 75_000) return 0;
  if (base <= 240_000) return Math.round((base - 75_000) * 0.015);
  if (base <= 800_000) return Math.round(2_475 + (base - 240_000) * 0.05);
  return Math.round(30_475 + (base - 800_000) * 0.1);
}

/**
 * Calcule un bulletin. Cascade explicite, vérifiable à la main :
 * le net est toujours inférieur au brut.
 */
export function calculerBulletin(employe: EmployeDemo): Bulletin {
  const brut = employe.salaireBase;
  const assiette = Math.min(brut, BAREME_CI.cnpsPlafondMensuel);

  const cotisationsSalariales = Math.round(
    (assiette * BAREME_CI.cnpsRetraiteSalarie) / 100,
  );
  const impot = impotSurSalaire(brut - cotisationsSalariales);
  const net = brut - cotisationsSalariales - impot;

  const chargesPatronales = Math.round(
    (assiette * BAREME_CI.cnpsRetraitePatronal) / 100 +
      (brut * BAREME_CI.prestationsFamiliales) / 100 +
      (brut * BAREME_CI.accidentTravail) / 100,
  );

  return {
    employe,
    brut,
    cotisationsSalariales,
    impot,
    net,
    chargesPatronales,
    coutTotal: brut + chargesPatronales,
  };
}

export const BULLETINS = EMPLOYES.map(calculerBulletin);

// -------------------------------------------------------------- intervenants

export type ModeRemuneration = "journee" | "tache" | "unite" | "forfait";

/**
 * Intervenant : ni utilisateur du logiciel, ni salarié déclaré.
 *
 * Maçon, ferrailleur, coffreur, manœuvre, peintre, mais aussi chauffeur
 * occasionnel, serveur extra, coiffeuse à la commission, ouvrier saisonnier ou
 * mécanicien à la tâche. Il n'a pas de bulletin de paie mais un bon de
 * paiement, et sa dépense ne se ventile pas comme un salaire.
 */
export interface IntervenantDemo {
  id: string;
  nom: string;
  qualification: string;
  telephone: string;
  mode: ModeRemuneration;
  /** Taux exprimé dans l'unité du mode : par jour, par tâche, par m². */
  taux: number;
  uniteLibelle: string;
  chantier: string;
  /** Quantité pointée sur la période : jours, tâches ou unités d'œuvre. */
  pointe: number;
  regle: number;
}

export const INTERVENANTS: IntervenantDemo[] = [
  { id: "i1", nom: "Ouattara Ibrahim", qualification: "Maçon", telephone: "+225 07 11 22 33 44", mode: "journee", taux: 8000, uniteLibelle: "jour", chantier: "Villa Riviera 3", pointe: 18, regle: 96000 },
  { id: "i2", nom: "Bamba Souleymane", qualification: "Maçon", telephone: "+225 05 66 77 88 99", mode: "unite", taux: 3500, uniteLibelle: "m² enduit", chantier: "Villa Riviera 3", pointe: 62, regle: 140000 },
  { id: "i3", nom: "Koné Salif", qualification: "Ferrailleur", telephone: "+225 01 44 55 66 77", mode: "journee", taux: 9000, uniteLibelle: "jour", chantier: "Immeuble Cocody", pointe: 22, regle: 198000 },
  { id: "i4", nom: "Diomandé Adama", qualification: "Manœuvre", telephone: "+225 07 88 99 00 11", mode: "journee", taux: 5000, uniteLibelle: "jour", chantier: "Immeuble Cocody", pointe: 24, regle: 90000 },
  { id: "i5", nom: "Coulibaly Yaya", qualification: "Coffreur", telephone: "+225 05 33 22 11 00", mode: "tache", taux: 45000, uniteLibelle: "coffrage", chantier: "Villa Riviera 3", pointe: 3, regle: 135000 },
  { id: "i6", nom: "N'Guessan Paul", qualification: "Peintre", telephone: "+225 01 77 66 55 44", mode: "unite", taux: 1200, uniteLibelle: "m² peint", chantier: "Villa Riviera 3", pointe: 210, regle: 180000 },
  { id: "i7", nom: "Touré Mamadou", qualification: "Chauffeur occasionnel", telephone: "+225 07 22 33 44 55", mode: "journee", taux: 12000, uniteLibelle: "jour", chantier: "Livraisons Abidjan", pointe: 9, regle: 108000 },
];

export const LIBELLE_MODE: Record<ModeRemuneration, string> = {
  journee: "À la journée",
  tache: "À la tâche",
  unite: "À l'unité d'œuvre",
  forfait: "Au forfait",
};

/** Montant dû à un intervenant : quantité pointée × taux, moins les acomptes. */
export function duIntervenant(intervenant: IntervenantDemo): number {
  return intervenant.pointe * intervenant.taux - intervenant.regle;
}
