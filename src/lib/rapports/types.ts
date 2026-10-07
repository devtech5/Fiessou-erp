import type { Droit } from "@/lib/droits/catalogue";

/**
 * Rapports : un même cadre pour tous les modules.
 *
 * Chaque module déclare ses rapports dans son propre `rapports.ts` — une clé,
 * un titre, le droit qui les ouvre et une fonction qui rend des colonnes et des
 * lignes. Le reste est commun : la page, le choix de la période, les totaux,
 * l'impression et l'export vers Excel. Un rapport ajouté à un module apparaît
 * partout sans écrire une ligne d'écran.
 *
 * Ce fichier ne dépend de rien : il se teste sans base.
 */

/**
 * Nature d'une colonne : elle décide de l'alignement, du format et du total.
 *
 *   montant  francs entiers                 2 900
 *   entier   un compte de choses            12
 *   quantite millièmes d'unité (voir `quantity`) 1 340 → « 1,34 »
 *   taux_bp  points de base                 1 250 → « 12,5 % »
 */
export type TypeColonne = "texte" | "montant" | "entier" | "quantite" | "date" | "taux_bp";

export interface Colonne {
  cle: string;
  libelle: string;
  type: TypeColonne;
  /** Additionnée en pied de tableau. Par défaut : les montants seulement. */
  total?: boolean;
}

export type Valeur = string | number | null;

export interface ResultatRapport {
  colonnes: Colonne[];
  lignes: Record<string, Valeur>[];
  /** Une précision de lecture, affichée sous le titre : périmètre, source. */
  note?: string;
}

export interface Periode {
  du: string;
  au: string;
}

export interface DefinitionRapport {
  /** Identifiant dans l'adresse : `/rapports/ventes-par-jour`. */
  cle: string;
  /** Clé du module dans le registre : le rapport disparaît avec son module. */
  module: string;
  /** Libellé de la rubrique où il se range : « Trésorerie », « Ventes ». */
  rubrique: string;
  titre: string;
  description: string;
  /** Droit qui l'ouvre. Celui du module consulté, le plus souvent. */
  droit: Droit;
  /**
   * `intervalle` : ce qui s'est passé entre deux dates (ventes, charges).
   * `situation` : l'état à une date (stock, créances) ; seul `au` compte.
   */
  periode: "intervalle" | "situation";
  executer: (organizationId: string, periode: Periode) => Promise<ResultatRapport>;
}

// --------------------------------------------------------------- calculs

const ADDITIONNABLES: readonly TypeColonne[] = ["montant", "entier", "quantite"];

export function colonneTotalisee(c: Colonne): boolean {
  return c.total ?? c.type === "montant";
}

/** Totaux des colonnes additionnées. Une valeur absente compte pour zéro. */
export function totaux(resultat: Pick<ResultatRapport, "colonnes" | "lignes">): Record<string, number> {
  const somme: Record<string, number> = {};
  for (const c of resultat.colonnes) {
    if (!colonneTotalisee(c) || !ADDITIONNABLES.includes(c.type)) continue;
    somme[c.cle] = resultat.lignes.reduce((s, l) => s + (typeof l[c.cle] === "number" ? (l[c.cle] as number) : 0), 0);
  }
  return somme;
}

// ---------------------------------------------------------------- format

const nombre = new Intl.NumberFormat("fr-FR");
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });
const taux = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Valeur telle qu'on la lit à l'écran. */
export function formaterValeur(v: Valeur, type: TypeColonne): string {
  if (v === null || v === "") return "";
  if (typeof v === "string") {
    if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
    return v;
  }
  switch (type) {
    case "quantite":
      return decimal.format(v / 1000);
    case "taux_bp":
      return `${taux.format(v / 100)} %`;
    default:
      return nombre.format(v);
  }
}

// ------------------------------------------------------------------- CSV

/**
 * Export pour Excel, réglé comme l'Excel français l'attend : point-virgule
 * entre les colonnes, virgule décimale, BOM en tête pour que les accents
 * s'ouvrent juste. Les nombres sortent sans séparateur de milliers : un
 * « 2 900 » serait lu comme du texte et ne s'additionnerait plus.
 */
export function versCsv(resultat: Pick<ResultatRapport, "colonnes" | "lignes">, avecTotaux = true): string {
  const cellule = (v: Valeur, type: TypeColonne): string => {
    if (v === null) return "";
    let texte: string;
    if (typeof v === "number") {
      texte =
        type === "quantite" ? String(v / 1000).replace(".", ",") : type === "taux_bp" ? String(v / 100).replace(".", ",") : String(v);
    } else {
      texte = formaterValeur(v, type);
    }
    return /[;"\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
  };

  const lignes = [resultat.colonnes.map((c) => cellule(c.libelle, "texte")).join(";")];
  for (const l of resultat.lignes) lignes.push(resultat.colonnes.map((c) => cellule(l[c.cle] ?? null, c.type)).join(";"));
  if (avecTotaux && resultat.lignes.length > 0) {
    const t = totaux(resultat);
    if (Object.keys(t).length > 0) {
      lignes.push(resultat.colonnes.map((c, i) => (c.cle in t ? cellule(t[c.cle], c.type) : i === 0 ? "Total" : "")).join(";"));
    }
  }
  return `﻿${lignes.join("\r\n")}\r\n`;
}

// --------------------------------------------------------------- périodes

const plusJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const finDuMois = (annee: number, mois: number) => new Date(Date.UTC(annee, mois, 0)).toISOString().slice(0, 10);

/** Les périodes qu'on demande le plus souvent, calculées depuis aujourd'hui. */
export function periodesRapides(aujourdhui: string): { cle: string; libelle: string; du: string; au: string }[] {
  const annee = Number(aujourdhui.slice(0, 4));
  const mois = Number(aujourdhui.slice(5, 7));
  const debutMois = `${aujourdhui.slice(0, 7)}-01`;
  const moisPrecedent = mois === 1 ? { a: annee - 1, m: 12 } : { a: annee, m: mois - 1 };
  const trimestre = Math.floor((mois - 1) / 3);
  const debutTrimestre = `${annee}-${String(trimestre * 3 + 1).padStart(2, "0")}-01`;
  return [
    { cle: "jour", libelle: "Aujourd'hui", du: aujourdhui, au: aujourdhui },
    { cle: "7j", libelle: "7 derniers jours", du: plusJours(aujourdhui, -6), au: aujourdhui },
    { cle: "mois", libelle: "Ce mois", du: debutMois, au: aujourdhui },
    {
      cle: "mois-1",
      libelle: "Mois dernier",
      du: `${moisPrecedent.a}-${String(moisPrecedent.m).padStart(2, "0")}-01`,
      au: finDuMois(moisPrecedent.a, moisPrecedent.m),
    },
    { cle: "trimestre", libelle: "Ce trimestre", du: debutTrimestre, au: aujourdhui },
    { cle: "annee", libelle: "Cette année", du: `${annee}-01-01`, au: aujourdhui },
    { cle: "annee-1", libelle: "Année dernière", du: `${annee - 1}-01-01`, au: `${annee - 1}-12-31` },
  ];
}

/** Période lue dans l'adresse ; « ce mois » par défaut, et jamais à l'envers. */
export function lirePeriode(params: { du?: string; au?: string }, aujourdhui: string): Periode {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const au = params.au && iso.test(params.au) ? params.au : aujourdhui;
  const du = params.du && iso.test(params.du) && params.du <= au ? params.du : `${au.slice(0, 7)}-01`;
  return { du, au };
}

/** Une date rendue par PostgreSQL — chaîne ou `Date` selon le pilote — ramenée à `AAAA-MM-JJ`. */
export const jourIso = (v: string | Date): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
