import { BONS, CAISSES, aRegulariser, reliquat } from "@/lib/fixtures/caisse-depenses";
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

/** Biens loués non rendus et adhérents bloqués à l'accueil. */
export interface EtatReservations {
  locationsEnRetard: number;
  abonnementsEpuises: number;
}

/**
 * Tâches dont l'échéance est passée. `equipe` ne compte que celles confiées
 * à d'autres, et n'est renseigné que pour qui attribue les tâches.
 */
export interface EtatTaches {
  miennesEnRetard: number;
  equipeEnRetard: number;
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
 * Facturation, stock, parc, missions, réservations et guichet viennent de la base — les autres
 * sources sont encore des fixtures, en attendant leurs modules.
 */
export function alertes(
  facturation: EtatFacturation,
  stock: EtatStock,
  parc: EtatParc,
  missions: EtatMissions,
  reservations: EtatReservations,
  /** Réseaux dont le float est bas au guichet ouvert, déjà nommés. */
  floatsBas: string[] = [],
  depenses: { aApprouver: number; montantAApprouver: number; sansPreuve: number } = { aApprouver: 0, montantAApprouver: 0, sansPreuve: 0 },
  taches: EtatTaches = { miennesEnRetard: 0, equipeEnRetard: 0 },
): Alerte[] {
  const liste: Alerte[] = [];

  // ------------------------------------------------------------ tâches
  // Celles de la personne d'abord : c'est à elle d'agir, sans attendre personne.
  if (taches.miennesEnRetard > 0) {
    liste.push({
      id: "taches-miennes-retard",
      gravite: "critique",
      source: "base",
      module: "Tâches",
      titre: "Vos tâches en retard",
      detail: "Échéance dépassée : terminez-les ou faites reporter l'échéance",
      href: "/taches",
      nombre: taches.miennesEnRetard,
    });
  }
  if (taches.equipeEnRetard > 0) {
    liste.push({
      id: "taches-equipe-retard",
      gravite: "attention",
      source: "base",
      module: "Tâches",
      titre: "Tâches de l'équipe en retard",
      detail: "Confiées à d'autres membres, échéance dépassée",
      href: "/taches?vue=toutes",
      nombre: taches.equipeEnRetard,
    });
  }

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

  // ----------------------------------------------------------- dépenses
  if (depenses.aApprouver > 0) {
    liste.push({
      id: "depenses-a-approuver",
      gravite: "attention",
      source: "base",
      module: "Projets",
      titre: "Dépenses à approuver",
      detail: `${depenses.montantAApprouver.toLocaleString("fr-FR")} FCFA en attente de décision`,
      href: "/projets/depenses",
      nombre: depenses.aApprouver,
    });
  }
  if (depenses.sansPreuve > 0) {
    liste.push({
      id: "depenses-sans-preuve",
      gravite: "attention",
      source: "base",
      module: "Projets",
      titre: "Dépenses payées sans preuve",
      detail: "Joignez le reçu ou la capture du transfert",
      href: "/projets/depenses",
      nombre: depenses.sansPreuve,
    });
  }

  // ----------------------------------------------------------- guichet
  if (floatsBas.length > 0) {
    liste.push({
      id: "float-bas",
      gravite: "critique",
      source: "base",
      module: "Guichet",
      titre: "Float insuffisant",
      detail: floatsBas.join(", "),
      href: "/monnaie",
      nombre: floatsBas.length,
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
  if (reservations.locationsEnRetard > 0) {
    liste.push({
      id: "locations-retard",
      gravite: "critique",
      source: "base",
      module: "Réservations",
      titre: "Matériel non restitué",
      detail: "Immobilisé chez un client, non louable",
      href: "/reservations",
      nombre: reservations.locationsEnRetard,
    });
  }

  if (reservations.abonnementsEpuises > 0) {
    liste.push({
      id: "abonnements",
      gravite: "information",
      source: "base",
      module: "Réservations",
      titre: "Abonnements épuisés",
      detail: "Accès refusé à l'accueil, à renouveler",
      href: "/reservations/abonnements",
      nombre: reservations.abonnementsEpuises,
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

  // La caisse et le mobile money encaissés au comptoir ou sur facture passent
  // au 5711 « Caisse Mobile Money » : c'est de l'argent électronique, pas des
  // billets dans le tiroir. Le compter en caisse ferait chercher au caissier,
  // le soir, des espèces qui n'ont jamais existé.
  // Le float du guichet de transfert (5712) est lui aussi de la monnaie
  // électronique, détenue chez les opérateurs.
  const mobile = cumul("5711") + cumul("5712");

  return [
    { libelle: "Banque", montant: cumul("52"), detail: "Comptes 52" },
    {
      libelle: "Mobile money",
      montant: cumul("53") + mobile,
      detail: "Comptes 53, 5711 et 5712",
    },
    { libelle: "Caisse", montant: cumul("57") - mobile, detail: "Comptes 57, hors 5711 et 5712" },
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
