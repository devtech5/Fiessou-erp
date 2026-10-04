import { BONS, CAISSES, aRegulariser, reliquat } from "@/lib/fixtures/caisse-depenses";
import { RESEAUX, SEUIL_FLOAT_BAS } from "@/lib/fixtures/monnaie";
import { CONTRATS } from "@/lib/fixtures/reservations";
import { ABONNEMENTS, seancesRestantes } from "@/lib/fixtures/reservations";
import { etatCourant } from "@/lib/approbation/circuit";
import type { SoldeCompte } from "@/lib/comptabilite/etats";

/**
 * Agrégation du tableau de bord.
 *
 * Le parti pris : un tableau de bord montre ce qui demande une DÉCISION, pas
 * tout ce que l'application sait. Aligner vingt chiffres dont aucun n'appelle
 * d'action, c'est garantir qu'on n'en lira aucun — et que le seul qui comptait
 * passera inaperçu.
 *
 * D'où deux blocs seulement : ce qui ne va pas, et de quoi juger la journée.
 */

export type Gravite = "critique" | "attention" | "information";

export interface Alerte {
  id: string;
  gravite: Gravite;
  /**
   * D'où vient le chiffre.
   *
   * `fixture` marque une alerte encore calculée sur un jeu d'essai. Elle ne
   * s'affiche que sur une instance d'aperçu : une alerte critique inventée sur
   * l'écran d'accueil est le pire endroit où mettre une donnée fausse — c'est
   * la première chose que l'exploitant lit le matin, et il agirait dessus.
   *
   * Le module ne suffit pas à trancher : le commercial lit la base pour ses
   * tiers et une fixture pour ses factures. La source, elle, est exacte.
   */
  source: "base" | "fixture";
  /** Module concerné, pour que l'exploitant sache où il atterrit. */
  module: string;
  titre: string;
  detail: string;
  href: string;
  /** Nombre d'éléments concernés, quand l'alerte en regroupe plusieurs. */
  nombre?: number;
}

const ORDRE: Record<Gravite, number> = {
  critique: 0,
  attention: 1,
  information: 2,
};

/**
 * État du stock, tel que la base le connaît.
 *
 * Passé en paramètre plutôt que lu ici : ce module reste
 * une fonction de mise en forme, sans accès à la base, donc lisible et
 * testable. C'est l'écran qui interroge.
 */
/**
 * Ce que le parc a d'urgent, réduit à deux nombres.
 *
 * Comme pour le stock : le tableau de bord ne lit pas la base lui-même, il
 * reçoit des faits déjà établis. C'est ce qui le garde testable sans
 * PostgreSQL, et ce qui empêche une requête de se glisser dans un module de
 * présentation.
 */
export interface EtatParc {
  /** Échéances dont le terme ou le seuil de compteur est franchi. */
  echeancesDepassees: number;
  /** Actifs en entretien ou immobilisés : indisponibles à l'exploitation. */
  indisponibles: number;
}

/** Ce que les missions ont d'urgent, réduit à deux nombres. */
export interface EtatMissions {
  /** Missions ouvertes dont l'échéance est passée. */
  enRetard: number;
  /** Missions échouées, à reprogrammer. */
  echouees: number;
}

/** Factures émises, échues et pas entièrement payées. */
export interface EtatFacturation {
  enRetard: number;
  montantEnRetard: number;
}

export interface EtatStock {
  ruptures: number;
  /** Articles dont l'autonomie tombe sous le délai de réaction habituel. */
  aCommanderVite: number;
  /** Valeur au coût moyen pondéré, en francs entiers. */
  valeur: number;
}

/**
 * Ce qui demande une décision aujourd'hui.
 *
 * Classé par gravité, pas par module : quelqu'un qui ouvre son application le
 * matin veut savoir ce qui brûle, pas parcourir un sommaire.
 *
 * Facturation, stock, parc et missions viennent de la base — les autres
 * sources sont encore des fixtures, en attendant leurs modules.
 */
export function alertes(
  facturation: EtatFacturation,
  stock: EtatStock,
  parc: EtatParc,
  missions: EtatMissions,
): Alerte[] {
  const liste: Alerte[] = [];

  // ------------------------------------------------------------- ventes
  // Plus d'alerte « pièces sans écriture » : une facture passe son écriture à
  // l'émission, dans la même transaction. L'écart ne peut plus exister.
  if (facturation.enRetard > 0) {
    liste.push({
      id: "factures-retard",
      gravite: "critique",
      source: "base",
      module: "Commercial",
      titre: "Factures impayées",
      detail: `${facturation.montantEnRetard.toLocaleString("fr-FR")} FCFA en souffrance`,
      href: "/commercial/factures",
      nombre: facturation.enRetard,
    });
  }

  // -------------------------------------------------------------- stock
  if (stock.ruptures > 0) {
    liste.push({
      id: "ruptures",
      gravite: "critique",
      source: "base",
      module: "Stock",
      titre: "Articles en rupture",
      // Un stock négatif compte ici aussi : il signale une sortie enregistrée
      // avant son entrée, et la vente suivante partira sur une quantité fausse.
      detail: "Aucune vente possible sur ces références",
      href: "/stock",
      nombre: stock.ruptures,
    });
  }

  if (stock.aCommanderVite > 0) {
    liste.push({
      id: "reappro",
      gravite: "attention",
      source: "base",
      module: "Stock",
      titre: "À commander sous trois jours",
      detail: "Le délai fournisseur ne sera pas tenu au-delà",
      href: "/stock/reapprovisionnement",
      nombre: stock.aCommanderVite,
    });
  }

  // ----------------------------------------------------------- guichet
  const floatBas = RESEAUX.filter((r) => r.float < SEUIL_FLOAT_BAS);
  if (floatBas.length > 0) {
    liste.push({
      id: "float-bas",
      gravite: "critique",
      source: "fixture",
      module: "Guichet",
      titre: "Float insuffisant",
      detail: floatBas.map((r) => r.nom).join(", "),
      href: "/monnaie",
      nombre: floatBas.length,
    });
  }

  // -------------------------------------------------------------- caisse
  const bonsEnAttente = BONS.filter((bon) => {
    const etat = etatCourant(bon.circuit, Boolean(bon.decaisseLe));
    return etat === "soumise" || etat === "en_validation";
  });
  if (bonsEnAttente.length > 0) {
    liste.push({
      id: "bons-attente",
      gravite: "attention",
      source: "fixture",
      module: "Comptabilité",
      titre: "Bons de caisse à valider",
      detail: "Quelqu'un attend une signature pour être payé",
      href: "/comptabilite/caisse",
      nombre: bonsEnAttente.length,
    });
  }

  const sansJustificatif = BONS.filter(aRegulariser);
  const reliquats = BONS.map(reliquat).filter(
    (r): r is number => r !== null && r > 0,
  );
  if (sansJustificatif.length > 0 || reliquats.length > 0) {
    liste.push({
      id: "avances",
      gravite: "attention",
      source: "fixture",
      module: "Comptabilité",
      titre: "Avances non soldées",
      detail: `${reliquats.reduce((s, r) => s + r, 0).toLocaleString("fr-FR")} FCFA à récupérer ou justifier`,
      href: "/comptabilite/caisse",
      nombre: sansJustificatif.length + reliquats.length,
    });
  }

  const caissesBasses = CAISSES.filter((c) => c.solde < c.seuilAlerte);
  if (caissesBasses.length > 0) {
    liste.push({
      id: "caisse-basse",
      gravite: "attention",
      source: "fixture",
      module: "Comptabilité",
      titre: "Caisse à réalimenter",
      detail: caissesBasses.map((c) => c.nom).join(", "),
      href: "/comptabilite/caisse",
      nombre: caissesBasses.length,
    });
  }

  // -------------------------------------------------------------- actifs
  if (parc.echeancesDepassees > 0) {
    liste.push({
      id: "echeances",
      gravite: "critique",
      source: "base",
      module: "Actifs",
      titre: "Échéances dépassées",
      // Rouler sans assurance ou sans visite valide n'est pas un retard
      // administratif : c'est une immobilisation au premier contrôle.
      detail: "Assurance, visite technique ou entretien au compteur",
      href: "/actifs/echeances",
      nombre: parc.echeancesDepassees,
    });
  }

  if (parc.indisponibles > 0) {
    liste.push({
      id: "actifs-indisponibles",
      gravite: "information",
      source: "base",
      module: "Actifs",
      titre: "Actifs indisponibles",
      detail: "En entretien ou immobilisés",
      href: "/actifs",
      nombre: parc.indisponibles,
    });
  }

  // ----------------------------------------------------------- locations
  const locationsEnRetard = CONTRATS.filter((c) => c.statut === "en_retard");
  if (locationsEnRetard.length > 0) {
    liste.push({
      id: "locations-retard",
      gravite: "critique",
      source: "fixture",
      module: "Réservations",
      titre: "Matériel non restitué",
      detail: "Immobilisé chez un client, non louable",
      href: "/reservations",
      nombre: locationsEnRetard.length,
    });
  }

  const abonnementsEpuises = ABONNEMENTS.filter((a) => {
    const reste = seancesRestantes(a);
    return reste !== null && reste <= 0;
  });
  if (abonnementsEpuises.length > 0) {
    liste.push({
      id: "abonnements",
      gravite: "information",
      source: "fixture",
      module: "Réservations",
      titre: "Abonnements épuisés",
      detail: "Accès refusé à l'accueil, à renouveler",
      href: "/reservations/abonnements",
      nombre: abonnementsEpuises.length,
    });
  }

  // ------------------------------------------------------------ missions
  if (missions.echouees > 0) {
    liste.push({
      id: "missions-echouees",
      gravite: "attention",
      source: "base",
      module: "Missions",
      titre: "Missions échouées",
      detail: "À reprogrammer",
      href: "/missions",
      nombre: missions.echouees,
    });
  }

  if (missions.enRetard > 0) {
    liste.push({
      id: "missions-retard",
      gravite: "attention",
      source: "base",
      module: "Missions",
      titre: "Missions en retard",
      detail: "Échéance dépassée, preuves du terrain attendues",
      href: "/missions",
      nombre: missions.enRetard,
    });
  }

  return liste.sort((a, b) => ORDRE[a.gravite] - ORDRE[b.gravite]);
}

export interface Tresorerie {
  libelle: string;
  montant: number;
  detail: string;
}

/**
 * Où se trouve l'argent, à l'instant.
 *
 * Déduit du grand livre et non d'un solde tenu à part : la trésorerie est la
 * conséquence des écritures, donc elle est vraie par construction. Un montant
 * stocké à côté finit toujours par diverger — il suffit d'un règlement saisi
 * en comptabilité sans repasser par l'écran qui entretenait le chiffre.
 *
 * Les trois lignes couvrent exactement les comptes que `positionComptable`
 * additionne — 52, 53, 57. Le total du tableau de bord et celui de l'écran de
 * comptabilité doivent tomber sur le même franc : deux chiffres différents pour
 * le même argent, et plus personne ne croit ni l'un ni l'autre.
 *
 * Le float du guichet et les caisses de dépenses reviendront ici quand leurs
 * modules liront la base. D'ici là, ce qui n'est pas comptabilisé ne s'affiche
 * pas — c'est écrit sous les cartes, parce qu'un exploitant qui compte son
 * tiroir doit savoir pourquoi l'écran annonce autre chose.
 */
export function tresorerie(soldes: SoldeCompte[]): Tresorerie[] {
  // Solde débiteur : une caisse qui doit plus qu'elle n'a reçu n'existe pas.
  // Un négatif signale une erreur de saisie, et s'affiche tel quel plutôt que
  // d'être ramené à zéro — le masquer laisserait l'erreur courir.
  const cumul = (prefixe: string) =>
    soldes
      .filter((s) => s.compte.startsWith(prefixe))
      .reduce((somme, s) => somme + s.debit - s.credit, 0);

  return [
    { libelle: "Banque", montant: cumul("52"), detail: "Comptes 52" },
    {
      libelle: "Mobile money",
      montant: cumul("53"),
      detail: "Comptes 53 · établissements financiers",
    },
    { libelle: "Caisse", montant: cumul("57"), detail: "Comptes 57" },
  ];
}

/**
 * Chiffres du jour, pour juger l'activité sans ouvrir un module.
 *
 * La valeur du stock arrive du dehors : elle se lit en base, au coût moyen
 * pondéré. Elle était auparavant estimée au prix de VENTE — ce qui affichait la
 * marge future comme si elle était déjà acquise, et gonflait le patrimoine de
 * l'entreprise d'un tiers.
 */
export interface ActiviteDuJour {
  /** Encaissé en caisse depuis l'ouverture de la journée. */
  encaisse: number;
  /** Nombre de tickets, pour situer le montant. */
  tickets: number;
  /** Créances clients ouvertes : lignes 41 non lettrées. */
  creances: number;
  /** Valeur du stock au coût moyen pondéré. */
  valeurStock: number;
}

/**
 * De quoi juger la journée.
 *
 * Les quatre chiffres viennent de la base — caisse, grand livre, stock. Aucun
 * n'est une projection ni une moyenne : ce sont des sommes d'écritures, à
 * l'unité près, comme l'exige la règle de l'argent entier.
 */
export function activiteDuJour(
  caisse: { chiffreAffaires: number; tickets: number },
  creances: number,
  valeurStock: number,
): ActiviteDuJour {
  return {
    encaisse: caisse.chiffreAffaires,
    tickets: caisse.tickets,
    creances,
    valeurStock,
  };
}
