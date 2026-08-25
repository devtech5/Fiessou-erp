import { ACTIFS, ECHEANCES, resteAvantEcheance } from "@/lib/fixtures/actifs";
import { BONS, CAISSES, aRegulariser, reliquat } from "@/lib/fixtures/caisse-depenses";
import { COMPTES_CLES } from "@/lib/fixtures/comptabilite";
import { DOCUMENTS, comptabilisable, totalTTC } from "@/lib/fixtures/gestion";
import { MISSIONS } from "@/lib/fixtures/missions";
import { RESEAUX, SEUIL_FLOAT_BAS, totauxJournee } from "@/lib/fixtures/monnaie";
import { CONTRATS } from "@/lib/fixtures/reservations";
import { ABONNEMENTS, seancesRestantes } from "@/lib/fixtures/reservations";
import { etatCourant } from "@/lib/approbation/circuit";

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
 * Passé en paramètre plutôt que lu ici, comme `piecesPassees` : ce module reste
 * une fonction de mise en forme, sans accès à la base, donc lisible et
 * testable. C'est l'écran qui interroge.
 */
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
 * `piecesPassees` et `stock` viennent de la base — les autres sources sont
 * encore des fixtures, en attendant leurs modules.
 */
export function alertes(
  piecesPassees: Record<string, string>,
  stock: EtatStock,
): Alerte[] {
  const liste: Alerte[] = [];

  // ------------------------------------------------------------- ventes
  const enRetard = DOCUMENTS.filter(
    (d) => d.nature === "facture" && d.statut === "en_retard",
  );
  if (enRetard.length > 0) {
    liste.push({
      id: "factures-retard",
      gravite: "critique",
      module: "Commercial",
      titre: "Factures impayées",
      detail: `${enRetard.reduce((s, f) => s + totalTTC(f), 0).toLocaleString("fr-FR")} FCFA en souffrance`,
      href: "/commercial/ventes",
      nombre: enRetard.length,
    });
  }

  const aComptabiliser = DOCUMENTS.filter(
    (d) => comptabilisable(d) && !piecesPassees[d.numero],
  );
  if (aComptabiliser.length > 0) {
    liste.push({
      id: "a-comptabiliser",
      gravite: "attention",
      module: "Comptabilité",
      titre: "Pièces sans écriture",
      // C'est l'écart entre ce que le commerce a vendu et ce que la
      // comptabilité sait. Le laisser courir rend la clôture impossible.
      detail: "Le commerce a facturé, la comptabilité ne le sait pas encore",
      href: "/commercial/ventes",
      nombre: aComptabiliser.length,
    });
  }

  // -------------------------------------------------------------- stock
  if (stock.ruptures > 0) {
    liste.push({
      id: "ruptures",
      gravite: "critique",
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
      module: "Comptabilité",
      titre: "Caisse à réalimenter",
      detail: caissesBasses.map((c) => c.nom).join(", "),
      href: "/comptabilite/caisse",
      nombre: caissesBasses.length,
    });
  }

  // -------------------------------------------------------------- actifs
  const echeancesDepassees = ECHEANCES.filter((e) => {
    if (e.joursRestants !== undefined) return e.joursRestants < 0;
    const reste = resteAvantEcheance(e);
    return reste !== null && reste <= 0;
  });
  if (echeancesDepassees.length > 0) {
    liste.push({
      id: "echeances",
      gravite: "critique",
      module: "Actifs",
      titre: "Échéances dépassées",
      // Rouler sans assurance ou sans visite valide n'est pas un retard
      // administratif : c'est une immobilisation au premier contrôle.
      detail: "Assurance ou visite technique expirée",
      href: "/actifs/echeances",
      nombre: echeancesDepassees.length,
    });
  }

  const indisponibles = ACTIFS.filter(
    (a) => a.statut === "entretien" || a.statut === "immobilise",
  );
  if (indisponibles.length > 0) {
    liste.push({
      id: "actifs-indisponibles",
      gravite: "information",
      module: "Actifs",
      titre: "Actifs indisponibles",
      detail: "En entretien ou immobilisés",
      href: "/actifs",
      nombre: indisponibles.length,
    });
  }

  // ----------------------------------------------------------- locations
  const locationsEnRetard = CONTRATS.filter((c) => c.statut === "en_retard");
  if (locationsEnRetard.length > 0) {
    liste.push({
      id: "locations-retard",
      gravite: "critique",
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
      module: "Réservations",
      titre: "Abonnements épuisés",
      detail: "Accès refusé à l'accueil, à renouveler",
      href: "/reservations/abonnements",
      nombre: abonnementsEpuises.length,
    });
  }

  // ------------------------------------------------------------ missions
  const missionsEchouees = MISSIONS.filter((m) => m.statut === "echouee");
  if (missionsEchouees.length > 0) {
    liste.push({
      id: "missions-echouees",
      gravite: "attention",
      module: "Missions",
      titre: "Missions échouées",
      detail: "À reprogrammer",
      href: "/missions",
      nombre: missionsEchouees.length,
    });
  }

  const preuvesEnAttente = MISSIONS.reduce((s, m) => s + m.enAttenteSynchro, 0);
  if (preuvesEnAttente > 0) {
    liste.push({
      id: "synchro",
      gravite: "information",
      module: "Missions",
      titre: "Preuves non remontées",
      // Une mission paraît close alors que sa preuve dort sur un téléphone.
      detail: "Encore sur les appareils, hors connexion",
      href: "/missions",
      nombre: preuvesEnAttente,
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
 * Le float du guichet y figure alors qu'il n'est pas de la trésorerie au sens
 * comptable : c'est de la valeur immobilisée chez un opérateur. L'exploitant,
 * lui, la compte — elle sort de sa poche et il ne peut pas en disposer.
 */
export function tresorerie(): Tresorerie[] {
  const banque = COMPTES_CLES.find((c) => c.numero === "521")!.solde;
  const caisseVente = COMPTES_CLES.find((c) => c.numero === "571")!.solde;
  const caissesDepenses = CAISSES.reduce((s, c) => s + c.solde, 0);
  const float = RESEAUX.reduce((s, r) => s + r.float, 0);

  return [
    { libelle: "Banque", montant: banque, detail: "Compte 521" },
    { libelle: "Caisse de vente", montant: caisseVente, detail: "Compte 571" },
    {
      libelle: "Caisses de dépenses",
      montant: caissesDepenses,
      detail: `${CAISSES.length} réserves`,
    },
    {
      libelle: "Float mobile money",
      montant: float,
      detail: `${RESEAUX.length} opérateurs`,
    },
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
export function activiteDuJour(valeurStock: number) {
  const guichet = totauxJournee();

  const encaisse = DOCUMENTS.filter(
    (d) => d.nature === "facture" && d.statut === "paye",
  ).reduce((s, f) => s + totalTTC(f), 0);

  const creances = DOCUMENTS.filter(
    (d) =>
      d.nature === "facture" &&
      (d.statut === "envoye" || d.statut === "en_retard"),
  ).reduce((s, f) => s + totalTTC(f), 0);

  return {
    encaisse,
    creances,
    operationsGuichet: guichet.operations,
    commissionsGuichet: guichet.commissions,
    valeurStock,
  };
}
