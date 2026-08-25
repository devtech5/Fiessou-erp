import "server-only";

import { newId } from "@/lib/ids";
import { allocate, allocateByWeights } from "@/lib/money";
import { UNITES, type CodeUnite } from "@/lib/quantite";
import { prochainNumero, type Transaction } from "@/lib/sequences";
import { creerDepotDans } from "@/modules/stock/creation";
import { creerPosteCaisseDans } from "@/modules/ventes/creation";
import { mouvementsStock, type TypeDepot } from "@/modules/stock/schema";

/**
 * Amorçage du stock de démonstration.
 *
 * Les mouvements sont insérés en BLOC, et non un par un via
 * `enregistrerMouvementDans`. Ce n'est pas un raccourci : un bon de réception
 * couvre plusieurs articles, un ticket de caisse aussi. Passer article par
 * article donnerait un numéro de pièce par ligne — trois cents bons de
 * réception pour un seul camion — en plus de trois cents allers-retours vers
 * Abidjan pendant que l'écran attend.
 */

export interface DepotDemo {
  code: string;
  nom: string;
  ville: string;
  type: TypeDepot;
  /** Part du stock initial versée dans ce dépôt, en poids relatif. */
  part: number;
}

/**
 * Quatre lieux, deux natures. Le dépôt approvisionne, le magasin vend : c'est
 * la configuration d'un grossiste-détaillant d'Abidjan, et elle suffit à
 * montrer qu'une quantité n'a de sens qu'attachée à un lieu.
 */
export const DEPOTS_DEMO: DepotDemo[] = [
  { code: "DEP-YOP", nom: "Dépôt Yopougon", ville: "Abidjan", type: "depot", part: 60 },
  { code: "DEP-ADJ", nom: "Dépôt Adjamé", ville: "Abidjan", type: "depot", part: 20 },
  { code: "MAG-TRE", nom: "Magasin Treichville", ville: "Abidjan", type: "magasin", part: 12 },
  { code: "MAG-BKE", nom: "Magasin Bouaké", ville: "Bouaké", type: "magasin", part: 8 },
];

/** Jours de vente simulés sur les trente derniers. */
const JOURS_DE_VENTE = 12;

/**
 * Ventes simulées d'un article qui n'a pas d'historique connu, en part de son
 * stock cible. Un quart du stock écoulé en un mois donne une autonomie d'environ
 * quatre mois : lent pour de l'épicerie, mais c'est un chiffre de démonstration,
 * pas une prévision.
 */
const ROTATION_PAR_DEFAUT = 0.25;

export interface ArticleAAmorcer {
  id: string;
  designation: string;
  unite: CodeUnite;
  /** Stock visé une fois toutes les ventes passées, en millièmes d'unité. */
  stockCible: number;
  prixAchat: number;
  /** Ventes des trente derniers jours, en millièmes. Zéro : déduites du stock. */
  ventes30j: number;
}

export interface ResultatStock {
  depots: number;
  mouvements: number;
  postes: number;
}

type LigneMouvement = typeof mouvementsStock.$inferInsert;

/** Décalage d'une date, en jours, à une heure ouvrée plausible. */
function ilYA(jours: number, heure = 9): Date {
  const date = new Date();
  date.setDate(date.getDate() - jours);
  date.setHours(heure, 0, 0, 0);
  return date;
}

/**
 * Répartit une quantité en parts entières d'unité vendable.
 *
 * Une unité non fractionnable se répartit en pièces entières : « 0,4 bouteille »
 * n'existe ni en rayon ni sur un bon de transfert. L'allocation porte donc sur
 * le nombre de pas, et la somme des parts retombe exactement sur le total —
 * c'est `allocateByWeights` qui le garantit, pas un arrondi ligne à ligne.
 */
function repartir(quantite: number, poids: number[], unite: CodeUnite): number[] {
  const pas = UNITES[unite].fractionnable ? 1 : 1000;
  return allocateByWeights(Math.floor(quantite / pas), poids).map((p) => p * pas);
}

function etaler(quantite: number, parts: number, unite: CodeUnite): number[] {
  const pas = UNITES[unite].fractionnable ? 1 : 1000;
  return allocate(Math.floor(quantite / pas), parts).map((p) => p * pas);
}

/**
 * Verse dépôts, réceptions et ventes dans une entreprise.
 *
 * Le stock final de chaque article retombe sur sa valeur cible : la réception
 * initiale porte la cible PLUS ce qui sera vendu ensuite. Sans cela, simuler un
 * mois de ventes creuserait des stocks négatifs partout, et l'écran de stock
 * afficherait une avarie au lieu d'une supérette.
 */
export async function amorcerStock(
  tx: Transaction,
  organizationId: string,
  catalogue: ArticleAAmorcer[],
  userId?: string,
): Promise<ResultatStock> {
  // -------------------------------------------------------------- les dépôts
  const depotsCrees: { id: string; part: number; nom: string }[] = [];

  for (const [index, depot] of DEPOTS_DEMO.entries()) {
    const { id } = await creerDepotDans(
      tx,
      organizationId,
      {
        code: depot.code,
        nom: depot.nom,
        ville: depot.ville,
        type: depot.type,
        parDefaut: index === 0,
      },
      userId,
    );
    depotsCrees.push({ id, part: depot.part, nom: depot.nom });
  }

  const principal = depotsCrees[0];
  const poids = depotsCrees.map((d) => d.part);

  // Un poste par magasin, aucun sur les dépôts : on n'encaisse pas un client
  // dans un entrepôt. Sans poste, l'écran de caisse n'a nulle part où numéroter
  // ses tickets et refuse de s'ouvrir.
  let postes = 0;
  for (const [index, depot] of depotsCrees.entries()) {
    if (DEPOTS_DEMO[index].type !== "magasin") continue;

    postes++;
    await creerPosteCaisseDans(
      tx,
      organizationId,
      {
        code: `C${String(postes).padStart(2, "0")}`,
        nom: `Caisse ${depot.nom}`,
        depotId: depot.id,
      },
      userId,
    );
  }

  // Un bon de réception par dépôt : c'est un camion, pas trois cents camions.
  const bons = new Map<string, string>();
  for (const depot of depotsCrees) {
    bons.set(
      depot.id,
      await prochainNumero(tx, organizationId, {
        cle: "mouvement:reception",
        prefix: `REC-${new Date().getFullYear()}-`,
        padding: 5,
        periode: String(new Date().getFullYear()),
      }),
    );
  }

  // Un ticket par journée de vente, partagé par tous les articles vendus ce
  // jour-là — comme un vrai ticket de caisse.
  const tickets: string[] = [];
  for (let jour = 0; jour < JOURS_DE_VENTE; jour++) {
    tickets.push(
      await prochainNumero(tx, organizationId, {
        cle: "mouvement:vente",
        prefix: `TIC-${new Date().getFullYear()}-`,
        padding: 5,
        periode: String(new Date().getFullYear()),
      }),
    );
  }

  const lignes: LigneMouvement[] = [];
  const receptionLe = ilYA(45, 7);

  for (const article of catalogue) {
    const ventes =
      article.ventes30j > 0
        ? article.ventes30j
        : Math.floor((article.stockCible * ROTATION_PAR_DEFAUT) / 1000) * 1000;

    // Le stock cible se répartit sur les quatre lieux ; les ventes, elles,
    // sortent toutes du dépôt principal. La réception du principal porte donc
    // sa part plus la totalité de ce qui sera vendu.
    const parts = repartir(article.stockCible, poids, article.unite);
    const parJour = etaler(ventes, JOURS_DE_VENTE, article.unite);
    const venduReel = parJour.reduce((somme, q) => somme + q, 0);

    for (const [index, depot] of depotsCrees.entries()) {
      const recu = parts[index] + (index === 0 ? venduReel : 0);
      if (recu <= 0) continue;

      lignes.push({
        id: newId(),
        organizationId,
        depotId: depot.id,
        articleId: article.id,
        type: "reception",
        quantite: recu,
        coutUnitaire: article.prixAchat,
        piece: bons.get(depot.id) ?? "REC",
        motif: null,
        userId: userId ?? null,
        effectueLe: receptionLe,
      });
    }

    parJour.forEach((quantite, index) => {
      if (quantite <= 0) return;

      lignes.push({
        id: newId(),
        organizationId,
        depotId: principal.id,
        articleId: article.id,
        type: "vente",
        quantite: -quantite,
        // Une seule entrée en stock : le coût moyen pondéré est le prix payé.
        coutUnitaire: article.prixAchat,
        piece: tickets[index],
        userId: userId ?? null,
        // Étalées du plus ancien au plus récent, à raison d'une journée sur
        // deux et demie — le mois se remplit sans que tout tombe le même jour.
        effectueLe: ilYA(28 - index * 2, 11 + (index % 6)),
      });
    });
  }

  // ------------------------------------------------ un peu de vie au journal
  // Deux transferts et un ajustement : de quoi montrer qu'un transfert compte
  // double, et qu'un écart d'inventaire porte toujours son motif.
  await ajouterMouvementsDeVie(tx, organizationId, catalogue, depotsCrees, lignes, userId);

  if (lignes.length > 0) {
    // Un seul aller-retour. Les insertions en boucle sur un pooler en mode
    // transaction sérialisent tout : trois cents lignes y prennent une minute.
    await tx.insert(mouvementsStock).values(lignes);
  }

  return { depots: depotsCrees.length, mouvements: lignes.length, postes };
}

async function ajouterMouvementsDeVie(
  tx: Transaction,
  organizationId: string,
  catalogue: ArticleAAmorcer[],
  depotsCrees: { id: string; nom: string }[],
  lignes: LigneMouvement[],
  userId?: string,
): Promise<void> {
  if (depotsCrees.length < 2) return;

  // Les articles les mieux pourvus : un transfert ne se fait pas sur un article
  // en rupture, et un ajustement sur un stock nul n'apprend rien.
  const fournis = [...catalogue]
    .filter((a) => a.stockCible >= 20_000)
    .sort((a, b) => b.stockCible - a.stockCible)
    .slice(0, 3);

  if (fournis.length === 0) return;

  const [source, destination] = depotsCrees;

  for (const [index, article] of fournis.slice(0, 2).entries()) {
    const piece = await prochainNumero(tx, organizationId, {
      cle: "mouvement:transfert",
      prefix: `TRF-${new Date().getFullYear()}-`,
      padding: 5,
      periode: String(new Date().getFullYear()),
    });

    const pas = UNITES[article.unite].fractionnable ? 1 : 1000;
    const quantite = Math.floor(article.stockCible / 10 / pas) * pas;
    if (quantite <= 0) continue;

    const groupeId = newId();
    const effectueLe = ilYA(3, 8 + index);

    // Deux lignes, jamais une. Une seule, en positif, créerait de la
    // marchandise qui n'est jamais entrée nulle part.
    lignes.push(
      {
        id: newId(),
        organizationId,
        depotId: source.id,
        articleId: article.id,
        type: "transfert",
        quantite: -quantite,
        coutUnitaire: article.prixAchat,
        piece,
        depotContrepartieId: destination.id,
        groupeId,
        userId: userId ?? null,
        effectueLe,
      },
      {
        id: newId(),
        organizationId,
        depotId: destination.id,
        articleId: article.id,
        type: "transfert",
        quantite,
        // La valeur voyage avec la marchandise : un aller-retour entre deux
        // dépôts ne doit pas revaloriser le stock.
        coutUnitaire: article.prixAchat,
        piece,
        depotContrepartieId: source.id,
        groupeId,
        userId: userId ?? null,
        effectueLe,
      },
    );
  }

  const casse = fournis[fournis.length - 1];
  const pas = UNITES[casse.unite].fractionnable ? 1 : 1000;
  const perdu = Math.max(pas, Math.floor(casse.stockCible / 100 / pas) * pas);

  lignes.push({
    id: newId(),
    organizationId,
    depotId: depotsCrees[0].id,
    articleId: casse.id,
    type: "ajustement",
    quantite: -perdu,
    coutUnitaire: casse.prixAchat,
    piece: await prochainNumero(tx, organizationId, {
      cle: "mouvement:ajustement",
      prefix: `INV-${new Date().getFullYear()}-`,
      padding: 5,
      periode: String(new Date().getFullYear()),
    }),
    motif: "Casse constatée à l'inventaire tournant",
    userId: userId ?? null,
    effectueLe: ilYA(2, 17),
  });
}
