/**
 * Registre des modules de Fiessou.
 *
 * Les 28 modules du périmètre ne sont pas 28 développements. Ils se répartissent
 * en trois couches :
 *
 *   · socle    — commun à tout métier, toujours présent
 *   · moteur   — construit une fois, servi à plusieurs métiers
 *   · metier   — préréglage posé sur un socle et des moteurs : écrans,
 *                catalogue de départ, comptes pré-affectés. Pas de code neuf.
 *
 * `key` est la valeur stockée dans `organization_modules.module_key` : c'est à
 * la fois le périmètre visible par l'entreprise et l'assiette de facturation.
 */

export type ModuleLayer = "socle" | "moteur" | "metier";

export type ModuleStatus = "planifie" | "en_cours" | "disponible";

export interface ModuleDefinition {
  key: string;
  name: string;
  layer: ModuleLayer;
  status: ModuleStatus;
  /** Modules dont celui-ci a besoin pour fonctionner. */
  requires: string[];
  description: string;
}

export const MODULES: ModuleDefinition[] = [
  // ---------------------------------------------------------------- socle
  {
    key: "tiers",
    name: "Tiers & Commercial",
    layer: "socle",
    // Fichier tiers en base, avec comptes auxiliaires et soldes déduits des
    // écritures. Restent les devis, factures et achats.
    status: "en_cours",
    requires: [],
    description:
      "Clients, fournisseurs, devis, factures, achats, encours. Absorbe le CRM.",
  },
  {
    key: "stock",
    name: "Catalogue & Stock",
    layer: "socle",
    // En base : articles, familles, unités, codes scannables, dépôts,
    // mouvements typés et valorisation au coût moyen pondéré. Restent
    // l'inventaire tournant, les lots et les dates de péremption.
    status: "en_cours",
    requires: [],
    description:
      "Articles, dépôts, mouvements typés, inventaires, valorisation, lots.",
  },
  {
    key: "pos",
    name: "Ventes & Encaissement",
    layer: "socle",
    status: "planifie",
    requires: ["stock"],
    description:
      "Caisse : sessions, caissiers, paiements, tickets. Fonctionne hors connexion.",
  },
  {
    key: "comptabilite",
    name: "Comptabilité",
    layer: "socle",
    status: "planifie",
    requires: ["tiers"],
    description:
      "SYSCOHADA, journaux, états financiers, fiscalité. Consomme les écritures des autres modules.",
  },
  {
    key: "personnes",
    name: "Personnes & Rémunération",
    layer: "socle",
    status: "planifie",
    requires: [],
    description:
      "Deux régimes : salariés (contrat, bulletin, CNPS, ITS) et intervenants " +
      "(maçon, manœuvre, tâcheron, extra) payés à la journée, à la tâche ou à l'unité d'œuvre.",
  },
  {
    key: "documents",
    name: "Documents & Signature",
    layer: "socle",
    status: "planifie",
    requires: [],
    description:
      "Pièces rattachées aux entités métier, permissions, signature électronique.",
  },

  // --------------------------------------------------------------- moteurs
  {
    key: "actifs",
    name: "Actifs & Maintenance",
    layer: "moteur",
    status: "planifie",
    requires: ["personnes"],
    description:
      "Fiche actif, affectation, interventions, échéances, coût de revient. " +
      "Porte parc informatique, parc automobile, flotte, garage et patrimoine.",
  },
  {
    key: "reservation",
    name: "Réservation de ressource",
    layer: "moteur",
    status: "planifie",
    requires: ["tiers"],
    description:
      "Ressource, calendrier anti-surréservation, tarif par durée, caution, contrat, retour. " +
      "Porte location, hôtellerie, fitness et salons.",
  },
  {
    key: "missions",
    name: "Missions & Terrain",
    layer: "moteur",
    status: "planifie",
    requires: ["personnes"],
    description:
      "Mission assignée, étapes, preuves horodatées et géolocalisées, formulaires. " +
      "Porte projet, collecte terrain, livraison, BTP et agriculture.",
  },
  {
    key: "billetterie",
    name: "Billetterie",
    layer: "moteur",
    status: "planifie",
    requires: [],
    description:
      "Départ programmé, plan de places, billet, contrôle, vente en ligne. " +
      "À ne pas confondre avec la livraison : une place sur un départ, pas un objet suivi.",
  },
  {
    key: "valeur_electronique",
    name: "Valeur électronique",
    layer: "moteur",
    status: "planifie",
    requires: [],
    description:
      "Float par réseau, opérations, barèmes de commission, rapprochement float/espèces. " +
      "Porte le transfert d'argent mobile money et la cabine téléphonique. " +
      "Ne dépend d'aucun autre module.",
  },

  // -------------------------------------------------------------- métiers
  { key: "boutique", name: "Boutique / Magasin", layer: "metier", status: "planifie", requires: ["pos", "stock"], description: "Commerce de détail." },
  { key: "restaurant", name: "Maquis / Restaurant", layer: "metier", status: "planifie", requires: ["pos", "stock"], description: "Tables, commandes, envoi cuisine." },
  { key: "kiosque", name: "Kiosque mobile money", layer: "metier", status: "planifie", requires: ["valeur_electronique"], description: "Agent de transfert et vente de crédit." },
  { key: "garage", name: "Garage", layer: "metier", status: "planifie", requires: ["actifs", "tiers"], description: "Interventions sur des actifs appartenant au client, donc facturables." },
  { key: "btp", name: "BTP", layer: "metier", status: "planifie", requires: ["missions", "stock", "personnes"], description: "Chantiers, matériaux, main-d'œuvre à la tâche." },
  { key: "hotellerie", name: "Hôtellerie / Résidence", layer: "metier", status: "planifie", requires: ["reservation"], description: "La ressource est une chambre, la réservation un séjour." },
  { key: "location", name: "Location", layer: "metier", status: "planifie", requires: ["reservation"], description: "Matériel, engins, biens immobiliers, matériel événementiel." },
  { key: "transport", name: "Transport", layer: "metier", status: "planifie", requires: ["billetterie"], description: "Gares routières, lignes, billets." },
  { key: "livraison", name: "Livraison", layer: "metier", status: "planifie", requires: ["missions"], description: "Colis, déménagement, transfert." },
  { key: "flotte", name: "Gestion de flotte", layer: "metier", status: "planifie", requires: ["actifs"], description: "Véhicules, entretiens, assurance, visite technique." },
  { key: "fitness", name: "Fitness", layer: "metier", status: "planifie", requires: ["reservation", "pos"], description: "Adhérents, formules, contrôle d'accès." },
  { key: "projet", name: "Gestion de projet", layer: "metier", status: "planifie", requires: ["missions"], description: "Projets, affectations, suivi d'avancement." },
  { key: "collecte", name: "Collecte de données terrain", layer: "metier", status: "planifie", requires: ["missions"], description: "Formulaires hors connexion. Le cas qui exige le plus la synchronisation différée." },
];

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export function getModule(key: string): ModuleDefinition | undefined {
  return BY_KEY.get(key);
}

export function modulesByLayer(layer: ModuleLayer): ModuleDefinition[] {
  return MODULES.filter((m) => m.layer === layer);
}

/**
 * Développe la liste des modules à activer en y ajoutant leurs dépendances.
 * Activer « garage » entraîne « actifs », « tiers » et « personnes ».
 */
export function resolveDependencies(keys: string[]): string[] {
  const resolved = new Set<string>();

  // Nommé `definition` et non `module` : ce dernier est réservé par CommonJS,
  // et Next refuse qu'on lui assigne quoi que ce soit.
  const visit = (key: string) => {
    if (resolved.has(key)) return;
    const definition = BY_KEY.get(key);
    if (!definition) throw new Error(`Module inconnu : ${key}`);
    resolved.add(key);
    definition.requires.forEach(visit);
  };

  keys.forEach(visit);
  return [...resolved];
}
