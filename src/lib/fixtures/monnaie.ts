/**
 * Jeu de démonstration — kiosque de transfert d'argent et de crédit.
 *
 * Métier dense en Côte d'Ivoire, tenu presque partout au cahier papier, et
 * absent de la totalité des douze modules du concurrent.
 *
 * Le principe à bien tenir : un guichet manipule DEUX réserves à la fois.
 *
 *   · le float — la monnaie électronique disponible chez chaque opérateur
 *   · les espèces — le liquide dans le tiroir
 *
 * Un dépôt client déplace de la valeur du float vers les espèces, un retrait
 * fait l'inverse. Hors commissions, la somme des deux ne bouge pas de la
 * journée : c'est cet invariant qui permet le rapprochement du soir et qui
 * révèle immédiatement un manquant.
 */

export type Reseau = "wave" | "orange" | "mtn" | "moov";

export interface ReseauInfo {
  id: Reseau;
  nom: string;
  /** Monnaie électronique disponible au guichet, déduite des opérations. */
  float: number;
  /** Float au moment de l'ouverture, pour mesurer la journée. */
  floatOuverture: number;
}

/** Float compté à l'ouverture, opérateur par opérateur. */
const FLOAT_OUVERTURE: Record<Reseau, number> = {
  wave: 1_000_000,
  orange: 500_000,
  mtn: 350_000,
  moov: 100_000,
};

export const NOM_RESEAU: Record<Reseau, string> = {
  wave: "Wave",
  orange: "Orange Money",
  mtn: "MTN MoMo",
  moov: "Moov Money",
};

/** Espèces comptées à l'ouverture du guichet. */
export const FOND_DE_CAISSE = 250_000;

// ------------------------------------------------------------- opérations

export type TypeOperation = "depot" | "retrait" | "credit";

export interface OperationDemo {
  id: string;
  type: TypeOperation;
  reseau: Reseau;
  /** Numéro du client, ou celui rechargé pour une vente de crédit. */
  numero: string;
  montant: number;
  commission: number;
  heure: string;
}

export const OPERATIONS: OperationDemo[] = [
  { id: "op1", type: "depot", reseau: "wave", numero: "07 88 45 12 33", montant: 50_000, commission: 300, heure: "14:32" },
  { id: "op2", type: "retrait", reseau: "orange", numero: "07 12 90 44 21", montant: 25_000, commission: 250, heure: "14:18" },
  { id: "op3", type: "credit", reseau: "mtn", numero: "05 66 21 08 74", montant: 1_000, commission: 50, heure: "14:05" },
  { id: "op4", type: "depot", reseau: "orange", numero: "01 44 78 90 12", montant: 100_000, commission: 500, heure: "13:47" },
  { id: "op5", type: "retrait", reseau: "wave", numero: "07 33 21 65 09", montant: 75_000, commission: 400, heure: "13:22" },
  { id: "op6", type: "depot", reseau: "mtn", numero: "05 90 12 34 56", montant: 15_000, commission: 150, heure: "12:58" },
  { id: "op7", type: "retrait", reseau: "moov", numero: "01 77 88 99 00", montant: 40_000, commission: 300, heure: "12:31" },
  { id: "op8", type: "credit", reseau: "orange", numero: "07 55 44 33 22", montant: 500, commission: 25, heure: "11:49" },
  { id: "op9", type: "depot", reseau: "wave", numero: "05 11 22 33 44", montant: 200_000, commission: 1_000, heure: "11:12" },
  { id: "op10", type: "retrait", reseau: "wave", numero: "07 98 76 54 32", montant: 30_000, commission: 250, heure: "10:40" },
];

export const LIBELLE_OPERATION: Record<TypeOperation, string> = {
  depot: "Dépôt",
  retrait: "Retrait",
  credit: "Crédit",
};

/**
 * Sens des mouvements selon le type d'opération, du point de vue du guichet.
 *
 *   Dépôt   — le client remet des espèces, l'agent envoie de la monnaie
 *             électronique. Le float baisse, la caisse monte.
 *   Retrait — le client reçoit des espèces, le compte de l'agent est crédité.
 *             Le float monte, la caisse baisse.
 *   Crédit  — vente de crédit d'appel, prélevée sur le float.
 */
export function effetSurFloat(operation: OperationDemo): number {
  switch (operation.type) {
    case "depot":
      return -operation.montant;
    case "retrait":
      return operation.montant;
    case "credit":
      return -operation.montant;
  }
}

export function effetSurEspeces(operation: OperationDemo): number {
  switch (operation.type) {
    case "depot":
      return operation.montant + operation.commission;
    case "retrait":
      return -operation.montant + operation.commission;
    case "credit":
      return operation.montant + operation.commission;
  }
}

/**
 * Float courant de chaque réseau : celui d'ouverture, corrigé des opérations
 * du jour.
 *
 * Déduit plutôt que saisi, pour une raison de fond : un solde codé à côté des
 * opérations qui le produisent finit toujours par diverger. C'est ce qui donne
 * chez le concurrent des écrans de démonstration dont les colonnes ne
 * s'additionnent pas — 1 200 plus 1 700 sous un total de 2 975.
 */
export const RESEAUX: ReseauInfo[] = (
  Object.entries(NOM_RESEAU) as [Reseau, string][]
).map(([id, nom]) => {
  const floatOuverture = FLOAT_OUVERTURE[id];
  const mouvement = OPERATIONS.filter((o) => o.reseau === id).reduce(
    (somme, o) => somme + effetSurFloat(o),
    0,
  );

  return { id, nom, floatOuverture, float: floatOuverture + mouvement };
});

// -------------------------------------------------------------- agrégats

export function totauxJournee() {
  const depots = OPERATIONS.filter((o) => o.type === "depot");
  const retraits = OPERATIONS.filter((o) => o.type === "retrait");
  const credits = OPERATIONS.filter((o) => o.type === "credit");

  const commissions = OPERATIONS.reduce((somme, o) => somme + o.commission, 0);

  return {
    operations: OPERATIONS.length,
    volumeDepots: depots.reduce((s, o) => s + o.montant, 0),
    volumeRetraits: retraits.reduce((s, o) => s + o.montant, 0),
    volumeCredits: credits.reduce((s, o) => s + o.montant, 0),
    nbDepots: depots.length,
    nbRetraits: retraits.length,
    nbCredits: credits.length,
    commissions,
  };
}

/**
 * Rapprochement de fin de journée.
 *
 * Les espèces attendues se déduisent du fond de caisse et des mouvements de la
 * journée. L'écart avec le comptage réel est le seul chiffre qui compte : il
 * dit s'il manque de l'argent, et combien.
 */
export function rapprochement(especesComptees: number) {
  const mouvementEspeces = OPERATIONS.reduce(
    (somme, o) => somme + effetSurEspeces(o),
    0,
  );
  const especesAttendues = FOND_DE_CAISSE + mouvementEspeces;

  const floatActuel = RESEAUX.reduce((s, r) => s + r.float, 0);
  const floatOuverture = RESEAUX.reduce((s, r) => s + r.floatOuverture, 0);

  return {
    especesAttendues,
    especesComptees,
    ecart: especesComptees - especesAttendues,
    floatOuverture,
    floatActuel,
    variationFloat: floatActuel - floatOuverture,
  };
}

/** Seuil sous lequel un float ne permet plus d'absorber les retraits courants. */
export const SEUIL_FLOAT_BAS = 150_000;

// ------------------------------------------------------------- commissions

/**
 * Barème de commission par tranche de montant.
 *
 * ⚠️ Valeurs de démonstration. Chaque opérateur publie sa propre grille et la
 * révise ; le barème réel doit être saisi par l'exploitant, opérateur par
 * opérateur, et non codé en dur.
 */
export const TRANCHES_COMMISSION = [
  { jusqua: 5_000, commission: 50 },
  { jusqua: 10_000, commission: 100 },
  { jusqua: 25_000, commission: 250 },
  { jusqua: 50_000, commission: 300 },
  { jusqua: 100_000, commission: 500 },
  { jusqua: 200_000, commission: 1_000 },
  { jusqua: Infinity, commission: 1_500 },
];

export function calculerCommission(montant: number): number {
  if (montant <= 0) return 0;
  return TRANCHES_COMMISSION.find((t) => montant <= t.jusqua)!.commission;
}
