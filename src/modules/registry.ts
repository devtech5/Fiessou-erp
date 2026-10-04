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

/**
 * Avancement du module, et il commande ce que l'application montre.
 *
 *   · planifie   — les écrans existent, mais ils lisent `src/lib/fixtures`.
 *                  Des chiffres inventés dans une interface finie.
 *   · en_cours   — les écrans lisent la base. Il manque des fonctions, pas des
 *                  données.
 *   · disponible — le périmètre annoncé est couvert.
 *
 * La frontière qui compte n'est pas entre `en_cours` et `disponible` : c'est
 * entre `planifie` et le reste. Montrer à un commerçant un stock qui n'est pas
 * le sien lui coûte sa confiance en une minute, et elle ne revient pas.
 */
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
    // écritures. Devis, factures, avoirs et règlements en base : l'émission
    // numérote, sort le stock et passe l'écriture dans une transaction. Restent
    // les achats fournisseurs et l'avoir partiel.
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
    // En base : postes de caisse, tickets, lignes avec prestation rattachée,
    // règlements multiples. Un encaissement sort son stock et pose son écriture
    // dans la même transaction, et la file locale encaisse sans réseau.
    // Restent la session de caisse — ouverture, fond, comptage — et l'avoir.
    status: "en_cours",
    requires: ["stock"],
    description:
      "Caisse : sessions, caissiers, paiements, tickets. Fonctionne hors connexion.",
  },
  {
    key: "comptabilite",
    name: "Comptabilité",
    layer: "socle",
    // En base : plan de comptes SYSCOHADA, journaux, écritures équilibrées et
    // états financiers déduits du grand livre. Restent la clôture d'exercice,
    // les déclarations fiscales et la caisse de dépenses.
    status: "en_cours",
    requires: ["tiers"],
    description:
      "SYSCOHADA, journaux, états financiers, fiscalité. Consomme les écritures des autres modules.",
  },
  {
    key: "personnes",
    name: "Personnes & Rémunération",
    layer: "socle",
    // En base : salariés et contrats, intervenants, pointages et bons de
    // paiement — le versement à un intervenant pose son écriture en 637. Les
    // bulletins se calculent depuis la base mais ne sont pas encore émis :
    // restent le barème réel, les déclarations et l'écriture de paie.
    status: "en_cours",
    requires: [],
    description:
      "Deux régimes : salariés (contrat, bulletin, CNPS, ITS) et intervenants " +
      "(maçon, manœuvre, tâcheron, extra) payés à la journée, à la tâche ou à l'unité d'œuvre.",
  },
  {
    key: "documents",
    name: "Documents & Signature",
    layer: "socle",
    // En base : bibliothèque, rattachement polymorphe, échéances de validité,
    // demandes de signature et signataires. Le fichier vit dans un dépôt privé,
    // lu par URL signée. Le module SUIT une signature, il ne la CERTIFIE pas :
    // restent la page publique de signature pour les tiers extérieurs, le code
    // à six chiffres réellement transmis, et tout ce qui ferait une signature
    // qualifiée au sens réglementaire.
    status: "en_cours",
    requires: [],
    description:
      "Pièces rattachées aux entités métier, permissions, signature électronique.",
  },

  {
    key: "archives",
    name: "Archives numériques",
    layer: "socle",
    // En base : espace d'archivage par personne, empreinte SHA-256 au dépôt,
    // retrait masquant pendant 24 h puis scellement, supervision par
    // l'administrateur légal avec vérification d'intégrité et journal des
    // accès. Restent la durée de conservation légale par nature de pièce et
    // l'export horodaté d'un dossier complet.
    status: "en_cours",
    requires: [],
    description:
      "Espace d'archivage de chaque utilisateur, intègre et tracé, consultable par l'administrateur légal.",
  },

  {
    key: "taches",
    name: "Tâches",
    layer: "socle",
    // En base : tâches numérotées, créées pour soi ou attribuées, exécutées
    // à faire → en cours → terminée avec compte rendu, annulation motivée,
    // réattribution journalisée. Restent les tâches récurrentes, les
    // sous-tâches et le rattachement à un projet ou à un client.
    status: "en_cours",
    requires: [],
    description: "Liste de tâches de chacun, attribution à un membre, exécution suivie et tracée.",
  },

  {
    key: "tresorerie",
    name: "Trésorerie",
    layer: "socle",
    // En base : caisses, banques et portefeuilles adossés à un compte de
    // classe 5, soldes lus dans les écritures ; virements internes en deux
    // temps par le 585 ; bons de caisse approuvés puis décaissés ; avances au
    // personnel (4251) justifiées ou remboursées ; arrêtés de caisse ;
    // rapprochement bancaire par import CSV ; plan de trésorerie à 13
    // semaines. Restent l'import OFX et les relevés mobile money.
    status: "en_cours",
    requires: ["comptabilite"],
    description: "Caisses, banques, mobile money, virements internes, petite caisse, avances, rapprochement bancaire, prévisions.",
  },

  // --------------------------------------------------------------- moteurs
  {
    key: "actifs",
    name: "Actifs & Maintenance",
    layer: "moteur",
    // En base : fiches d'actifs, interventions, relevés de compteur et
    // échéances à double déclencheur. Le coût d'entretien est la somme des
    // interventions, le compteur le dernier relevé. Restent l'amortissement,
    // la facturation des interventions sur actif de client et la récurrence
    // automatique des échéances honorées.
    status: "en_cours",
    requires: ["personnes"],
    description:
      "Fiche actif, affectation, interventions, échéances, coût de revient. " +
      "Porte parc informatique, parc automobile, flotte, garage et patrimoine.",
  },
  {
    key: "reservation",
    name: "Réservation de ressource",
    layer: "moteur",
    // En base : ressources et grille de tarifs, contrats avec contrôle de
    // disponibilité verrouillé, remise (location + caution en 165) et
    // restitution (retenue en 758), abonnements et passages. Restent la
    // facturation des locations longues et le paiement fractionné.
    status: "en_cours",
    requires: ["tiers"],
    description:
      "Ressource, calendrier anti-surréservation, tarif par durée, caution, contrat, retour. " +
      "Porte location, hôtellerie, fitness et salons.",
  },
  {
    key: "missions",
    name: "Missions & Terrain",
    layer: "moteur",
    // En base : missions, étapes validées dans l'ordre, preuves horodatées sur
    // l'appareil (photo, position, signature, note), formulaires de collecte.
    // Restent la file hors connexion de l'appareil du livreur, le téléversement
    // des photos hors réseau et la facturation des missions.
    status: "en_cours",
    requires: ["personnes"],
    description:
      "Mission assignée, étapes, preuves horodatées et géolocalisées, formulaires. " +
      "Porte projet, collecte terrain, livraison, BTP et agriculture.",
  },
  {
    key: "billetterie",
    name: "Billetterie",
    layer: "moteur",
    // En base : lignes, départs à tarif figé, plan de places protégé par un
    // index unique, billets nominatifs avec écriture, contrôle à la montée,
    // non-présentés au départ, annulation contrepassée. Restent la vente en
    // ligne et le billet imprimé avec son code.
    status: "en_cours",
    requires: [],
    description:
      "Départ programmé, plan de places, billet, contrôle, vente en ligne. " +
      "À ne pas confondre avec la livraison : une place sur un départ, pas un objet suivi.",
  },
  {
    key: "valeur_electronique",
    name: "Valeur électronique",
    layer: "moteur",
    // En base : sessions de guichet, floats par réseau, opérations contrôlées
    // contre les deux réserves, clôture avec rapprochement et écriture.
    // Restent les barèmes de commission par opérateur et le reçu imprimé.
    status: "en_cours",
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
  {
    key: "projet",
    name: "Projets et dépenses",
    layer: "metier",
    // En base : projets affectés à un responsable, budget suivi, dépenses en
    // circuit (demande, approbation par un autre, paiement avec écriture),
    // photos et preuves de paiement jointes. Restent les tâches et le planning.
    status: "en_cours",
    requires: [],
    description: "Projets, affectation, budget, dépenses tracées de la demande au paiement, photos et preuves.",
  },
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
 * Vrai quand les écrans du module lisent la base et non un jeu d'essai.
 *
 * C'est la seule question que pose l'application avant d'ouvrir un module à un
 * client. Un module inconnu du registre est fermé : mieux vaut une entrée
 * manquante qu'une entrée qui ment.
 */
export function estLivre(key: string): boolean {
  const definition = BY_KEY.get(key);
  return definition !== undefined && definition.status !== "planifie";
}

/** Les clés des modules livrés, dans l'ordre du registre. */
export const MODULES_LIVRES: string[] = MODULES.filter((m) =>
  estLivre(m.key),
).map((m) => m.key);

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
