import "server-only";

import type { Transaction } from "@/lib/sequences";
import type { CategorieDepense } from "@/modules/projets/calcul";
import {
  approuverDepenseDans,
  cloreDepenseDans,
  creerProjetDans,
  demanderDepenseDans,
  payerDepenseDans,
} from "@/modules/projets/creation";
import type { MoyenDepense } from "@/modules/projets/schema";

/**
 * Amorçage des projets et dépenses.
 *
 * Deux projets, des dépenses à chaque étape du circuit — payée, approuvée,
 * en attente, rejetée — pour que l'écran montre la traçabilité de bout en
 * bout. Tout passe par les fonctions du module : numérotation, contrôle du
 * budget, écriture au paiement.
 */

const JOUR = 24 * 3600 * 1000;
const jour = (decalage: number) => new Date(Date.now() + decalage * JOUR).toISOString().slice(0, 10);

type Suite = { payer: MoyenDepense; reference?: string } | "approuver" | { rejeter: string } | null;

const PROJETS: {
  nom: string;
  description: string;
  budget: number | null;
  debut: number;
  fin: number;
  depenses: { objet: string; categorie: CategorieDepense; montant: number; tva?: boolean; fournisseur?: string; il_y_a: number; suite: Suite }[];
}[] = [
  {
    nom: "Ouverture boutique Yopougon",
    description: "Aménagement du local de Yopougon Siporex : peinture, électricité, rayonnages et enseigne.",
    budget: 2_500_000,
    debut: -20,
    fin: 25,
    depenses: [
      { objet: "Peinture glycéro — 12 seaux", categorie: "materiaux", montant: 186_000, tva: true, fournisseur: "Quincaillerie Adjamé", il_y_a: 18, suite: { payer: "especes" } },
      { objet: "Câblage et tableau électrique", categorie: "entretien", montant: 420_000, fournisseur: "Élec Plus Yopougon", il_y_a: 15, suite: { payer: "mobile_money", reference: "OM.2610.44812" } },
      { objet: "Rayonnages métalliques — 8 travées", categorie: "materiaux", montant: 960_000, tva: true, fournisseur: "Métal Côte d'Ivoire", il_y_a: 6, suite: "approuver" },
      { objet: "Main-d'œuvre peintres — 6 jours", categorie: "main_oeuvre", montant: 90_000, il_y_a: 10, suite: { payer: "especes" } },
      { objet: "Enseigne lumineuse 3 m", categorie: "petit_materiel", montant: 350_000, fournisseur: "Pub Néon Abidjan", il_y_a: 2, suite: null },
      { objet: "Climatiseur 2 CV", categorie: "materiaux", montant: 480_000, il_y_a: 4, suite: { rejeter: "Pas prévu au budget : à reporter après l'ouverture" } },
    ],
  },
  {
    nom: "Campagne de distribution Bouaké",
    description: "Tournée de prospection des revendeurs de Bouaké et Yamoussoukro.",
    budget: null,
    debut: -5,
    fin: 10,
    depenses: [
      { objet: "Carburant camionnette — aller", categorie: "transport", montant: 45_000, il_y_a: 5, suite: { payer: "especes" } },
      { objet: "Location salle de présentation", categorie: "location", montant: 75_000, fournisseur: "Hôtel du Centre Bouaké", il_y_a: 3, suite: "approuver" },
    ],
  },
];

export async function amorcerProjets(
  tx: Transaction,
  organizationId: string,
  userId: string,
): Promise<{ projets: number; depenses: number }> {
  let nombre = 0;
  for (const p of PROJETS) {
    const { id: projetId } = await creerProjetDans(
      tx,
      organizationId,
      { nom: p.nom, description: p.description, budget: p.budget, debut: jour(p.debut), fin: jour(p.fin), responsableUserId: userId },
      userId,
    );

    for (const d of p.depenses) {
      const le = new Date(Date.now() - d.il_y_a * JOUR);
      const { id } = await demanderDepenseDans(
        tx,
        organizationId,
        {
          projetId,
          objet: d.objet,
          categorie: d.categorie,
          montant: d.montant,
          tauxTva: d.tva ? 1800 : 0,
          fournisseurLibelle: d.fournisseur ?? null,
        },
        userId,
        le,
      );
      nombre++;
      if (d.suite === null) continue;
      if (typeof d.suite === "object" && "rejeter" in d.suite) {
        await cloreDepenseDans(tx, organizationId, id, "rejetee", d.suite.rejeter, userId);
        continue;
      }
      // Le propriétaire qui installe la démonstration approuve ses propres demandes.
      await approuverDepenseDans(tx, organizationId, id, { userId, estProprietaire: true }, false, new Date(le.getTime() + 3600 * 1000));
      if (d.suite === "approuver") continue;
      await payerDepenseDans(tx, organizationId, id, { moyen: d.suite.payer, reference: d.suite.reference }, userId, new Date(le.getTime() + 26 * 3600 * 1000));
    }
  }
  return { projets: PROJETS.length, depenses: nombre };
}
