/**
 * Catalogue des droits, et rôles préréglés.
 *
 * Le catalogue est alimenté par le CODE, jamais par l'utilisateur : une
 * permission n'existe que si une action serveur ou un écran la vérifie. La
 * table `permissions` n'en est que le reflet en base, synchronisé par
 * `pnpm db:droits`, et sert de clé étrangère aux rôles qu'une entreprise crée
 * elle-même.
 *
 * D'où la règle de résolution, volontairement asymétrique :
 *
 *   · rôle préréglé (`proprietaire`, `gerant`, `caissier`…) → droits lus ICI.
 *     Aucune requête, et un déploiement qui ajoute une permission la donne
 *     immédiatement aux rôles concernés, sans migration de données.
 *   · rôle créé par l'entreprise → droits lus dans `role_permissions`.
 *
 * Ce fichier ne dépend de rien : ni base, ni React, ni `server-only`. C'est ce
 * qui permet de le tester sans base, et de le réutiliser plus tard côté client
 * hors connexion — la caisse doit savoir qui a le droit d'annuler un ticket
 * même quand le réseau est tombé.
 */

export interface DefinitionDroit {
  cle: string;
  /** Module du registre auquel le droit se rattache — l'assiette de facturation. */
  moduleKey: string;
  libelle: string;
  description?: string;
}

/**
 * `organisation` n'est pas un module du registre : c'est le transverse — les
 * membres, les paramètres, l'abonnement. Il ne se vend pas, il ne se coupe pas.
 */
const TRANSVERSE = "organisation";

export const DROITS = [
  // ---------------------------------------------------------------- tiers
  {
    cle: "tiers.fiche.consulter",
    moduleKey: "tiers",
    libelle: "Consulter les tiers",
    description: "Voir la liste des clients et des fournisseurs, et leurs encours.",
  },
  {
    cle: "tiers.fiche.gerer",
    moduleKey: "tiers",
    libelle: "Gérer les tiers",
    description: "Créer, modifier et archiver un client ou un fournisseur.",
  },

  // ---------------------------------------------------------------- stock
  {
    cle: "stock.article.consulter",
    moduleKey: "stock",
    libelle: "Consulter le catalogue et le stock",
  },
  {
    cle: "stock.article.gerer",
    moduleKey: "stock",
    libelle: "Gérer les articles",
    description: "Créer, modifier et archiver un article, fixer son prix.",
  },
  {
    cle: "stock.depot.gerer",
    moduleKey: "stock",
    libelle: "Gérer les dépôts",
    description: "Ouvrir et fermer un dépôt, un magasin, un véhicule de tournée.",
  },
  {
    cle: "stock.mouvement.saisir",
    moduleKey: "stock",
    libelle: "Saisir un mouvement de stock",
    description: "Entrée, sortie, transfert, correction d'inventaire.",
  },

  // ------------------------------------------------------------------ pos
  {
    cle: "pos.vente.encaisser",
    moduleKey: "pos",
    libelle: "Encaisser",
    description: "Ouvrir la caisse et encaisser un ticket.",
  },
  {
    cle: "pos.vente.consulter",
    moduleKey: "pos",
    libelle: "Consulter les ventes",
  },
  {
    cle: "pos.vente.annuler",
    moduleKey: "pos",
    libelle: "Annuler un ticket",
    description:
      "Geste de contrôle : il défait une recette encaissée, remet la marchandise " +
      "en stock et contre-passe l'écriture. Séparé de l'encaissement à dessein.",
  },
  {
    cle: "pos.poste.gerer",
    moduleKey: "pos",
    libelle: "Gérer les postes de caisse",
    description: "Créer un poste, le rattacher à un appareil, changer son dépôt.",
  },
  {
    cle: "pos.session.ouvrir",
    moduleKey: "pos",
    libelle: "Ouvrir une session de caisse",
    description: "Déclarer le fond de caisse et prendre le tiroir.",
  },
  {
    cle: "pos.session.cloturer",
    moduleKey: "pos",
    libelle: "Clôturer une session de caisse",
    description: "Compter le tiroir et constater l'écart.",
  },

  // --------------------------------------------------------- comptabilité
  {
    cle: "comptabilite.ecriture.consulter",
    moduleKey: "comptabilite",
    libelle: "Consulter la comptabilité",
  },
  {
    cle: "comptabilite.ecriture.enregistrer",
    moduleKey: "comptabilite",
    libelle: "Enregistrer une écriture",
    description: "Comptabiliser une pièce, saisir une écriture au journal.",
  },

  // ----------------------------------------------------------- personnes
  {
    cle: "personnes.consulter",
    moduleKey: "personnes",
    libelle: "Consulter le personnel",
    description: "Voir les salariés, les intervenants et ce qui leur est dû.",
  },
  {
    cle: "personnes.salarie.gerer",
    moduleKey: "personnes",
    libelle: "Gérer les salariés",
    description: "Embaucher, modifier un contrat, sortir des effectifs.",
  },
  {
    cle: "personnes.intervenant.gerer",
    moduleKey: "personnes",
    libelle: "Gérer les intervenants",
    description: "Ouvrir la fiche d'un maçon, d'un extra, d'un chauffeur occasionnel.",
  },
  {
    cle: "personnes.pointage.saisir",
    moduleKey: "personnes",
    libelle: "Pointer un intervenant",
    description:
      "Constater les journées, les tâches ou les unités d'œuvre réalisées. " +
      "Le geste du chef d'équipe, sur le chantier.",
  },
  {
    cle: "personnes.paiement.regler",
    moduleKey: "personnes",
    libelle: "Régler un intervenant",
    description:
      "Émettre un bon de paiement. Geste de décaissement : il sort de l'argent " +
      "de la caisse, il est séparé du pointage à dessein.",
  },

  // -------------------------------------------------------------- actifs
  {
    cle: "actifs.consulter",
    moduleKey: "actifs",
    libelle: "Consulter les actifs",
    description: "Voir le parc, son coût d'entretien et ses échéances.",
  },
  {
    cle: "actifs.fiche.gerer",
    moduleKey: "actifs",
    libelle: "Gérer les actifs",
    description:
      "Ouvrir une fiche, l'affecter à quelqu'un, changer son état de service.",
  },
  {
    cle: "actifs.intervention.saisir",
    moduleKey: "actifs",
    libelle: "Saisir une intervention",
    description: "Entretien, réparation, contrôle, et le relevé de compteur qui va avec.",
  },
  {
    cle: "actifs.echeance.gerer",
    moduleKey: "actifs",
    libelle: "Gérer les échéances",
    description: "Assurance, visite technique, garantie, entretien périodique.",
  },

  // ---------------------------------------------------------- facturation
  {
    cle: "commercial.piece.consulter",
    moduleKey: "tiers",
    libelle: "Consulter les devis et factures",
    description: "Voir les pièces commerciales, leurs règlements et ce qui reste dû.",
  },
  {
    cle: "commercial.piece.gerer",
    moduleKey: "tiers",
    libelle: "Établir devis et factures",
    description:
      "Préparer un brouillon, l'émettre, convertir un devis. L'émission d'une " +
      "facture sort le stock et passe l'écriture.",
  },
  {
    cle: "commercial.piece.annuler",
    moduleKey: "tiers",
    libelle: "Annuler une facture",
    description: "Émettre l'avoir qui annule une facture. Défait une recette : à réserver.",
  },
  {
    cle: "commercial.reglement.encaisser",
    moduleKey: "tiers",
    libelle: "Encaisser un règlement client",
    description: "Enregistrer un paiement reçu sur une facture.",
  },

  // ---------------------------------------------------------- réservations
  {
    cle: "reservation.consulter",
    moduleKey: "reservation",
    libelle: "Consulter les réservations",
    description: "Voir le parc louable, le planning, les contrats et les adhérents.",
  },
  {
    cle: "reservation.ressource.gerer",
    moduleKey: "reservation",
    libelle: "Gérer les ressources louables",
    description: "Ajouter un bien, fixer sa grille de tarifs et sa caution, le mettre en maintenance.",
  },
  {
    cle: "reservation.contrat.gerer",
    moduleKey: "reservation",
    libelle: "Établir les contrats",
    description:
      "Réserver, remettre le bien (encaissement et caution), constater la restitution, annuler.",
  },
  {
    cle: "reservation.abonnement.gerer",
    moduleKey: "reservation",
    libelle: "Gérer les adhérents",
    description: "Inscrire un adhérent, encaisser sa formule, enregistrer ses venues.",
  },

  // ------------------------------------------------------------- missions
  {
    cle: "missions.consulter",
    moduleKey: "missions",
    libelle: "Consulter les missions",
    description: "Voir les missions, leurs étapes et les preuves rapportées.",
  },
  {
    cle: "missions.mission.gerer",
    moduleKey: "missions",
    libelle: "Gérer les missions",
    description:
      "Ouvrir une mission, l'attribuer, la déclarer échouée ou l'annuler. " +
      "Séparé de la saisie terrain : celui qui planifie n'est pas celui qui rapporte.",
  },
  {
    cle: "missions.terrain.saisir",
    moduleKey: "missions",
    libelle: "Rapporter du terrain",
    description:
      "Valider une étape, joindre une photo, une position, une signature, une note, " +
      "répondre à un formulaire. Le geste du chef d'équipe ou du livreur.",
  },
  {
    cle: "missions.formulaire.gerer",
    moduleKey: "missions",
    libelle: "Composer les formulaires",
    description: "Créer un formulaire de collecte et choisir ses champs.",
  },

  // ----------------------------------------------------------- documents
  {
    cle: "documents.consulter",
    moduleKey: "documents",
    libelle: "Consulter les documents",
    description: "Voir la bibliothèque et ouvrir une pièce jointe.",
  },
  {
    cle: "documents.gerer",
    moduleKey: "documents",
    libelle: "Déposer et retirer un document",
    description:
      "Joindre une pièce à un client, un salarié, un actif. Retirer un document " +
      "efface son fichier pour de bon.",
  },
  {
    cle: "documents.signature.demander",
    moduleKey: "documents",
    libelle: "Demander une signature",
    description: "Ouvrir une demande et désigner ses signataires.",
  },
  {
    cle: "documents.signature.signer",
    moduleKey: "documents",
    libelle: "Signer",
    description:
      "Apposer sa signature sur une demande. Distinct du droit de la demander : " +
      "celui qui prépare le contrat n'est pas forcément celui qui l'engage.",
  },

  // ------------------------------------------------- modules en préparation
  // Ces écrans montrent encore des données d'exemple ; le droit gouverne leur
  // accès dès maintenant, pour que l'ouverture du module ne soit pas le moment
  // où l'on découvre que tout le monde y entre.
  { cle: "billetterie.consulter", moduleKey: "billetterie", libelle: "Consulter la billetterie" },
  {
    cle: "valeur_electronique.consulter",
    moduleKey: "valeur_electronique",
    libelle: "Consulter le guichet",
  },

  // --------------------------------------------------------- organisation
  {
    cle: "organisation.membre.gerer",
    moduleKey: TRANSVERSE,
    libelle: "Gérer les membres",
    description: "Inviter quelqu'un, changer son rôle, révoquer son accès.",
  },
  {
    cle: "organisation.parametres.gerer",
    moduleKey: TRANSVERSE,
    libelle: "Gérer l'entreprise",
    description:
      "Identité de l'entreprise, modules souscrits, abonnement. " +
      "Ce qui engage financièrement reste au propriétaire.",
  },
] as const satisfies readonly DefinitionDroit[];

export type Droit = (typeof DROITS)[number]["cle"];

export const TOUS_LES_DROITS: readonly Droit[] = DROITS.map((d) => d.cle);

const CLES = new Set<string>(TOUS_LES_DROITS);

export function droitConnu(cle: string): cle is Droit {
  return CLES.has(cle);
}

export function definitionDroit(cle: Droit): DefinitionDroit {
  // Le catalogue est figé à la compilation : une clé typée y est toujours.
  return DROITS.find((d) => d.cle === cle) as DefinitionDroit;
}

/**
 * Une entrée du catalogue, sa clé resserrée sur les droits qui existent.
 *
 * `DefinitionDroit` sert à déclarer le catalogue et accepte n'importe quelle
 * chaîne ; ce type-ci sert à le lire, et ne laisse passer qu'un droit connu.
 */
export interface EntreeCatalogue extends Omit<DefinitionDroit, "cle"> {
  cle: Droit;
}

export interface GroupeCatalogue {
  moduleKey: string;
  droits: EntreeCatalogue[];
}

/**
 * Le catalogue groupé par module, dans l'ordre de déclaration.
 *
 * Sert à composer un rôle : une liste plate de vingt-trois cases à cocher ne
 * se lit pas, alors que « Stock : consulter, gérer les articles, gérer les
 * dépôts, saisir un mouvement » se décide d'un coup d'œil. Le libellé du
 * module est résolu par l'appelant, dans le registre — ce fichier ne dépend
 * de rien.
 */
export function droitsParModule(): GroupeCatalogue[] {
  const groupes: GroupeCatalogue[] = [];

  for (const droit of DROITS) {
    const groupe = groupes.find((g) => g.moduleKey === droit.moduleKey);
    if (groupe) groupe.droits.push(droit);
    else groupes.push({ moduleKey: droit.moduleKey, droits: [droit] });
  }

  return groupes;
}

/**
 * Ce qu'un rôle peut recevoir, compte tenu de qui le compose.
 *
 * On n'accorde que ce que l'on détient soi-même. Sans cette règle, un gérant
 * composerait un rôle portant des droits qu'il n'a pas — l'abonnement, par
 * exemple — et le confierait à quelqu'un d'autre : le plafond de ses propres
 * droits deviendrait contournable en deux gestes.
 *
 * Les clés inconnues tombent au passage : le catalogue est la seule autorité
 * sur ce qui existe.
 */
export function droitsAccordables(
  detenus: ReadonlySet<Droit>,
  demandes: readonly string[],
): Droit[] {
  const retenus: Droit[] = [];

  for (const demande of demandes) {
    if (droitConnu(demande) && detenus.has(demande) && !retenus.includes(demande)) {
      retenus.push(demande);
    }
  }

  return retenus;
}

// --------------------------------------------------------------------- rôles

/**
 * Rôles préréglés, fournis par Fiessou.
 *
 * Ils correspondent aux fonctions qu'on rencontre réellement dans une boutique
 * ou un maquis d'Abidjan, pas à une hiérarchie théorique. Une entreprise qui
 * n'y trouve pas son compte crée son propre rôle : celui-là tire ses droits de
 * la base.
 */
export interface PresetRole {
  cle: string;
  nom: string;
  description: string;
  droits: readonly Droit[];
}

const CONSULTATION_COMMERCE = [
  "tiers.fiche.consulter",
  "stock.article.consulter",
  "pos.vente.consulter",
  "commercial.piece.consulter",
] as const satisfies readonly Droit[];

export const PRESETS_ROLES = [
  {
    cle: "proprietaire",
    nom: "Propriétaire",
    description: "Tous les droits, y compris l'abonnement.",
    droits: TOUS_LES_DROITS,
  },
  {
    cle: "gerant",
    nom: "Gérant",
    description:
      "Tient l'exploitation au quotidien. Tout sauf ce qui engage " +
      "financièrement l'entreprise.",
    droits: TOUS_LES_DROITS.filter((cle) => cle !== "organisation.parametres.gerer"),
  },
  {
    cle: "caissier",
    nom: "Caissier",
    description:
      "Encaisse et tient son tiroir. N'annule pas : une annulation défait une " +
      "recette, elle appartient à celui qui répond de la caisse.",
    droits: [
      "pos.vente.encaisser",
      "pos.vente.consulter",
      "pos.session.ouvrir",
      "pos.session.cloturer",
      "stock.article.consulter",
      "tiers.fiche.consulter",
    ],
  },
  {
    cle: "magasinier",
    nom: "Magasinier",
    description: "Tient le stock : réceptions, sorties, transferts, inventaire.",
    droits: [
      "stock.article.consulter",
      "stock.article.gerer",
      "stock.depot.gerer",
      "stock.mouvement.saisir",
      "tiers.fiche.consulter",
    ],
  },
  {
    cle: "comptable",
    nom: "Comptable",
    description:
      "Voit tout ce qui produit une écriture, et n'écrit qu'au journal. " +
      "Souvent externe au commerce : il ne touche ni au stock ni à la caisse.",
    droits: [
      ...CONSULTATION_COMMERCE,
      "tiers.fiche.gerer",
      "comptabilite.ecriture.consulter",
      "comptabilite.ecriture.enregistrer",
    ],
  },
] as const satisfies readonly PresetRole[];

const PRESET_PAR_CLE = new Map<string, PresetRole>(
  PRESETS_ROLES.map((preset) => [preset.cle, preset]),
);

export function presetRole(cle: string | null | undefined): PresetRole | undefined {
  return cle ? PRESET_PAR_CLE.get(cle) : undefined;
}

// ----------------------------------------------------------------- résolution

export interface ContexteDroits {
  /** Clé du rôle porté par le rattachement — `null` si le rôle a été supprimé. */
  cleRole: string | null;
  /** Créateur de l'entreprise. Ne peut jamais se retrouver enfermé dehors. */
  estProprietaire: boolean;
  /**
   * Accords lus dans `role_permissions`. Ne servent qu'aux rôles créés par
   * l'entreprise : un rôle préréglé tire les siens du code.
   */
  accords?: readonly string[];
}

/**
 * Droits effectifs d'un rattachement.
 *
 * Le propriétaire a tout, sans condition : l'entreprise lui appartient, et une
 * configuration malheureuse ne doit pas pouvoir lui fermer sa propre porte.
 *
 * Tout le reste échoue fermé — rôle inconnu, rôle sans accord, clé inventée :
 * l'ensemble est vide, et chaque vérification refuse.
 */
export function resoudreDroits(contexte: ContexteDroits): Set<Droit> {
  if (contexte.estProprietaire) return new Set(TOUS_LES_DROITS);

  const preset = presetRole(contexte.cleRole);
  if (preset) return new Set(preset.droits);

  const effectifs = new Set<Droit>();
  for (const accord of contexte.accords ?? []) {
    // Une clé disparue du catalogue — droit renommé, module retiré — ne donne
    // plus rien. La ligne reste en base, elle ne décide plus.
    if (droitConnu(accord)) effectifs.add(accord);
  }
  return effectifs;
}
