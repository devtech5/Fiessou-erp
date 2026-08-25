/**
 * Circuit d'approbation.
 *
 * Logique pure, sans React ni base : c'est ici que se décide qui doit valider
 * quoi, donc le seul endroit qui doive être juste.
 *
 * Construit pour le bon de caisse, mais volontairement générique. Demande
 * d'achat, congés, avance sur salaire, note de frais et sortie de stock
 * exceptionnelle suivent exactement le même chemin — émetteur, supérieur,
 * direction, exécution — et n'auront pas à le réécrire.
 */

export type RoleValideur = "superieur" | "direction";

export type Decision = "approuve" | "refuse";

export type EtatDemande =
  | "brouillon"
  | "soumise"
  | "en_validation"
  | "approuvee"
  | "refusee"
  | "executee"
  | "annulee";

export const LIBELLE_ETAT: Record<EtatDemande, string> = {
  brouillon: "Brouillon",
  soumise: "Soumise",
  en_validation: "En validation",
  approuvee: "Approuvée",
  refusee: "Refusée",
  executee: "Décaissée",
  annulee: "Annulée",
};

export interface Personne {
  id: string;
  nom: string;
  fonction: string;
  /** Supérieur hiérarchique. Nul pour un dirigeant. */
  superieurId: string | null;
  /** Habilité à valider au titre de la direction. */
  direction: boolean;
}

export interface EtapeCircuit {
  role: RoleValideur;
  /** Personne attendue. Nulle quand l'émetteur n'a pas de supérieur. */
  valideurId: string | null;
  valideurNom: string;
  decision?: Decision;
  parNom?: string;
  le?: string;
  motif?: string;
}

/**
 * Seuil au-delà duquel la direction doit valider en plus du supérieur.
 *
 * Un seuil est indispensable. Faire remonter un taxi à 5 000 F jusqu'à la
 * direction garantit qu'au bout d'une semaine plus personne ne valide rien, et
 * que les bons partent sans signature.
 */
export const SEUIL_DIRECTION = 100_000;

/**
 * Détermine les étapes de validation d'une demande.
 *
 * Règle intangible : **l'émetteur ne valide jamais sa propre demande**, quelle
 * que soit sa fonction. C'est tout l'intérêt du contrôle. Un dirigeant qui
 * engage une dépense la fait donc valider par un autre membre de la direction.
 */
export function construireCircuit(
  emetteur: Personne,
  montant: number,
  annuaire: Personne[],
): EtapeCircuit[] {
  const etapes: EtapeCircuit[] = [];

  // 1. Le supérieur direct, quand l'émetteur en a un.
  if (emetteur.superieurId) {
    const superieur = annuaire.find((p) => p.id === emetteur.superieurId);
    if (superieur && superieur.id !== emetteur.id) {
      etapes.push({
        role: "superieur",
        valideurId: superieur.id,
        valideurNom: superieur.nom,
      });
    }
  }

  // 2. La direction, au-delà du seuil — ou systématiquement pour un dirigeant,
  //    puisque son bon n'a franchi aucun palier hiérarchique.
  const exigeDirection = montant > SEUIL_DIRECTION || emetteur.superieurId === null;

  if (exigeDirection) {
    // Tout dirigeant SAUF l'émetteur. On ne se valide pas soi-même.
    const dirigeants = annuaire.filter((p) => p.direction && p.id !== emetteur.id);

    etapes.push({
      role: "direction",
      valideurId: dirigeants[0]?.id ?? null,
      valideurNom:
        dirigeants.length === 0
          ? "Aucun valideur disponible"
          : dirigeants.length === 1
            ? dirigeants[0].nom
            : "Direction",
    });
  }

  return etapes;
}

/**
 * Une demande dont le circuit ne comporte aucun valideur possible ne peut pas
 * être approuvée. Le cas se produit dans une structure à dirigeant unique : il
 * faut alors un co-validateur désigné, ou un contrôle a posteriori assumé.
 */
export function circuitImpossible(etapes: EtapeCircuit[]): boolean {
  return etapes.length === 0 || etapes.some((e) => e.valideurId === null);
}

/** État courant déduit des décisions déjà prises. */
export function etatCourant(
  etapes: EtapeCircuit[],
  decaisse: boolean,
): EtatDemande {
  if (decaisse) return "executee";
  if (etapes.some((e) => e.decision === "refuse")) return "refusee";
  if (etapes.every((e) => e.decision === "approuve")) return "approuvee";
  if (etapes.some((e) => e.decision === "approuve")) return "en_validation";
  return "soumise";
}

/** Prochaine étape en attente, ou null si le circuit est achevé. */
export function etapeEnAttente(etapes: EtapeCircuit[]): EtapeCircuit | null {
  return etapes.find((e) => !e.decision) ?? null;
}

export function etapesFranchies(etapes: EtapeCircuit[]): number {
  return etapes.filter((e) => e.decision === "approuve").length;
}
