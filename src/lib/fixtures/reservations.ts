import "server-only";

import type { Transaction } from "@/lib/sequences";
import { ajouterJours } from "@/modules/reservations/calcul";
import {
  creerRessourceDans,
  enregistrerPassageDans,
  inscrireAdherentDans,
  remettreDans,
  reserverDans,
  restituerDans,
  annulerContratDans,
} from "@/modules/reservations/creation";
import type { MoyenLocation, TypeRessource } from "@/modules/reservations/schema";

/**
 * Amorçage de la réservation de ressource.
 *
 * Un seul moteur porte location de matériel, d'engins et d'événementiel,
 * résidences meublées et salles. Le jeu passe par les VRAIES fonctions du
 * module — réservation (avec son contrôle de disponibilité), remise,
 * restitution, inscription, passage — et non par des insertions directes : il
 * prouve que les règles laissent passer un parcours réel.
 */

interface RessourceDemo {
  designation: string;
  type: TypeRessource;
  categorie: string;
  quantite: number;
  tarifJour?: number;
  tarifSemaine?: number;
  tarifMois?: number;
  caution: number;
}

const RESSOURCES: RessourceDemo[] = [
  { designation: "Bétonnière 350 L", type: "equipement", categorie: "BTP", quantite: 2, tarifJour: 15_000, tarifSemaine: 80_000, tarifMois: 280_000, caution: 150_000 },
  { designation: "Groupe électrogène 15 kVA", type: "equipement", categorie: "BTP", quantite: 1, tarifJour: 35_000, tarifSemaine: 190_000, tarifMois: 650_000, caution: 500_000 },
  { designation: "Échafaudage 6 m — lot", type: "equipement", categorie: "BTP", quantite: 4, tarifJour: 8_000, tarifSemaine: 45_000, tarifMois: 150_000, caution: 80_000 },
  { designation: "Chaise plastique — lot de 50", type: "equipement", categorie: "Événementiel", quantite: 12, tarifJour: 12_500, caution: 50_000 },
  { designation: "Bâche 6 × 12 m", type: "equipement", categorie: "Événementiel", quantite: 3, tarifJour: 40_000, caution: 100_000 },
  { designation: "Sonorisation 2 × 500 W", type: "equipement", categorie: "Événementiel", quantite: 2, tarifJour: 75_000, caution: 300_000 },
  { designation: "Studio meublé 101", type: "chambre", categorie: "Résidence Cocody", quantite: 1, tarifJour: 25_000, tarifSemaine: 150_000, tarifMois: 450_000, caution: 450_000 },
  { designation: "Appartement 2 pièces 201", type: "chambre", categorie: "Résidence Cocody", quantite: 1, tarifJour: 40_000, tarifSemaine: 240_000, tarifMois: 700_000, caution: 700_000 },
  { designation: "Salle de fête — 150 places", type: "salle", categorie: "Événementiel", quantite: 1, tarifJour: 250_000, caution: 200_000 },
];

type Suite =
  | { remise: MoyenLocation; retour?: { etat: "bon" | "endommage" | "perdu"; retenue: number } }
  | { annulation: string }
  | null;

interface ContratDemo {
  ressource: number;
  client: string;
  quantite: number;
  /** Décalages en jours par rapport à aujourd'hui. */
  debut: number;
  fin: number;
  suite: Suite;
}

const CONTRATS: ContratDemo[] = [
  { ressource: 0, client: "Ets Sopé Naby", quantite: 1, debut: -3, fin: 4, suite: { remise: "especes" } },
  // Fin passée, bien pas rendu : le contrat apparaît « en retard ».
  { ressource: 1, client: "Restaurant Akwaba", quantite: 1, debut: -6, fin: -2, suite: { remise: "mobile_money" } },
  { ressource: 4, client: "Kouadio Yao", quantite: 2, debut: -1, fin: 2, suite: { remise: "especes" } },
  { ressource: 5, client: "Maquis Le Baoulé", quantite: 1, debut: -12, fin: -10, suite: { remise: "especes", retour: { etat: "endommage", retenue: 45_000 } } },
  { ressource: 3, client: "Restaurant Akwaba", quantite: 4, debut: -20, fin: -18, suite: { remise: "mobile_money", retour: { etat: "bon", retenue: 0 } } },
  { ressource: 2, client: "Quincaillerie Adjamé", quantite: 2, debut: 3, fin: 10, suite: null },
  { ressource: 6, client: "Pharmacie du Plateau", quantite: 1, debut: -5, fin: 24, suite: { remise: "banque" } },
  { ressource: 8, client: "Kouadio Yao", quantite: 1, debut: 6, fin: 6, suite: { annulation: "Mariage reporté" } },
];

interface AdherentDemo {
  nom: string;
  formule: string;
  debut: number;
  duree: number;
  montant: number;
  seances: number | null;
  venues: number;
  moyen: MoyenLocation;
}

const ADHERENTS: AdherentDemo[] = [
  { nom: "Yao Prince", formule: "Illimité mensuel", debut: -10, duree: 30, montant: 25_000, seances: null, venues: 6, moyen: "mobile_money" },
  { nom: "Aya Danielle", formule: "12 séances", debut: -20, duree: 60, montant: 18_000, seances: 12, venues: 11, moyen: "especes" },
  { nom: "Bamba Souleymane", formule: "8 séances", debut: -15, duree: 30, montant: 13_000, seances: 8, venues: 8, moyen: "especes" },
  { nom: "Koné Salif", formule: "Annuel", debut: -100, duree: 365, montant: 210_000, seances: null, venues: 4, moyen: "banque" },
];

export async function amorcerReservations(
  tx: Transaction,
  organizationId: string,
  clients: Map<string, string>,
  userId: string,
): Promise<{ ressources: number; contrats: number; adherents: number }> {
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const ids: string[] = [];

  for (const r of RESSOURCES) {
    const { id } = await creerRessourceDans(tx, organizationId, r, userId);
    ids.push(id);
  }

  let contrats = 0;
  for (const c of CONTRATS) {
    const clientId = clients.get(c.client);
    if (!clientId) continue;
    const { id } = await reserverDans(
      tx,
      organizationId,
      {
        ressourceId: ids[c.ressource],
        clientId,
        quantite: c.quantite,
        debut: ajouterJours(aujourdHui, c.debut),
        fin: ajouterJours(aujourdHui, c.fin),
      },
      userId,
    );
    contrats += 1;

    if (c.suite && "annulation" in c.suite) {
      await annulerContratDans(tx, organizationId, id, c.suite.annulation, userId);
    } else if (c.suite) {
      await remettreDans(tx, organizationId, id, c.suite.remise, userId);
      if (c.suite.retour) await restituerDans(tx, organizationId, id, c.suite.retour, userId);
    }
  }

  for (const a of ADHERENTS) {
    const debut = ajouterJours(aujourdHui, a.debut);
    const { id } = await inscrireAdherentDans(
      tx,
      organizationId,
      {
        nom: a.nom,
        formule: a.formule,
        debut,
        fin: ajouterJours(debut, a.duree - 1),
        montant: a.montant,
        seancesIncluses: a.seances,
        moyen: a.moyen,
      },
      userId,
    );
    for (let i = 0; i < a.venues; i += 1) {
      await enregistrerPassageDans(tx, organizationId, id, userId, aujourdHui);
    }
  }

  return { ressources: RESSOURCES.length, contrats, adherents: ADHERENTS.length };
}
