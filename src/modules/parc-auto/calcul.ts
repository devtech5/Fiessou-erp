/**
 * Calculs du parc automobile. Sans dépendance : testés sans base, lus par le
 * serveur et par le navigateur.
 *
 * Les volumes sont en millièmes de litre (millilitres), les montants en francs
 * entiers, les distances en kilomètres entiers. Aucun flottant ne sort d'ici :
 * la consommation se rend en millilitres aux cent kilomètres.
 */

export const ENERGIES = {
  essence: "Essence",
  gasoil: "Gasoil",
  hybride: "Hybride",
  electrique: "Électrique",
  gpl: "GPL",
} as const;

export const USAGES = ["Service", "Transport de personnes", "Livraison", "Véhicule de fonction", "Chantier"] as const;

export interface PleinMesure {
  faitLe: Date;
  /** Millilitres. */
  volume: number;
  montant: number;
  kilometrage: number | null;
  complet: boolean;
}

export interface Consommation {
  /** Millilitres aux cent kilomètres, ou nul tant que deux pleins complets manquent. */
  mlPour100: number | null;
  /** Distance couverte par la mesure. */
  distance: number;
  /** Volume consommé sur cette distance. */
  volume: number;
}

/**
 * Consommation moyenne, méthode « plein à plein ».
 *
 * Entre deux pleins complets, ce qu'on a remis dans le réservoir est
 * exactement ce que la route a brûlé — appoints intermédiaires compris. Le
 * premier plein complet sert de repère : son volume compense le trajet
 * PRÉCÉDENT, pas celui qui suit, et n'entre pas dans le compte.
 *
 * Les pleins sans kilométrage ne peuvent pas borner une mesure ; leur volume
 * compte quand même s'ils tombent entre deux bornes.
 */
export function consommation(pleins: readonly PleinMesure[]): Consommation {
  const ordonnes = [...pleins].sort((a, b) => a.faitLe.getTime() - b.faitLe.getTime());
  const bornes = ordonnes
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.complet && p.kilometrage !== null);
  if (bornes.length < 2) return { mlPour100: null, distance: 0, volume: 0 };

  const premiere = bornes[0];
  const derniere = bornes[bornes.length - 1];
  const distance = (derniere.p.kilometrage ?? 0) - (premiere.p.kilometrage ?? 0);
  if (distance <= 0) return { mlPour100: null, distance: 0, volume: 0 };

  let volume = 0;
  for (let i = premiere.i + 1; i <= derniere.i; i++) volume += ordonnes[i].volume;

  return { mlPour100: Math.round((volume * 100) / distance), distance, volume };
}

/** « 8,4 L/100 km » à partir de millilitres aux cent kilomètres. */
export function formaterConsommation(mlPour100: number | null): string {
  if (mlPour100 === null) return "—";
  const dixiemes = Math.round(mlPour100 / 100);
  return `${Math.floor(dixiemes / 10)},${dixiemes % 10} L/100 km`;
}

/** « 42,5 L » à partir de millilitres. */
export function formaterLitres(ml: number): string {
  const centiemes = Math.round(ml / 10);
  const entier = Math.floor(centiemes / 100).toLocaleString("fr-FR");
  const reste = centiemes % 100;
  return reste === 0 ? `${entier} L` : `${entier},${String(reste).padStart(2, "0").replace(/0$/, "")} L`;
}

/** Prix au litre déduit, en francs entiers. */
export function prixAuLitre(montant: number, ml: number): number {
  if (ml <= 0) return 0;
  return Math.round((montant * 1000) / ml);
}

/**
 * Coût au kilomètre : carburant et entretien rapportés à la distance mesurée.
 * Nul tant que la distance est nulle — un chiffre inventé ferait comparer des
 * véhicules sur rien.
 */
export function coutAuKm(carburant: number, entretien: number, distance: number): number | null {
  if (distance <= 0) return null;
  return Math.round((carburant + entretien) / distance);
}

/**
 * Normalise une immatriculation ivoirienne pour la comparer et la ranger :
 * majuscules, espaces et tirets réduits. « 1234 fx 01 » → « 1234 FX 01 ».
 */
export function normaliserImmatriculation(saisie: string): string {
  return saisie
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}
