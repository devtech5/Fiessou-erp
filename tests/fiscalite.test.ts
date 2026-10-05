import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import {
  ecritureCloture,
  ecritureLiquidationTva,
  ecriturePaiementTva,
  echeanceTva,
  finDeMois,
  liquiderTva,
  moisSuivant,
  obligationsTva,
  refusCloture,
  refusDeclarationTva,
  refusPeriodeVerrouillee,
  resultatExercice,
  toucheTva,
  type DeclarationConnue,
  type SoldeTva,
} from "@/modules/fiscalite/calcul";
import { positionComptable } from "@/lib/comptabilite/etats";

const ligne = (e: { lignes: { compte: string; debit: number; credit: number }[] }, compte: string) => e.lignes.find((l) => l.compte === compte);

describe("liquidation de la TVA", () => {
  const soldes = [
    { compte: "4431", libelle: "TVA facturée sur ventes", solde: -180_000 },
    { compte: "4452", libelle: "TVA récupérable sur achats", solde: 54_000 },
  ];

  it("doit la différence entre collectée et déductible", () => {
    const l = liquiderTva(soldes, 10_000);
    expect(l).toEqual({ collectee: 180_000, deductible: 54_000, creditAnterieur: 10_000, aPayer: 116_000, creditReporte: 0 });
    const e = ecritureLiquidationTva({ mois: "2026-09", date: finDeMois("2026-09"), soldes, liquidation: l });
    expect(e && estEquilibree(e)).toBe(true);
    expect(ligne(e!, "4431")?.debit).toBe(180_000);
    expect(ligne(e!, "4452")?.credit).toBe(54_000);
    expect(ligne(e!, "4441")?.credit).toBe(116_000);
    expect(e!.date).toBe("2026-09-30");
  });

  it("reporte un crédit quand la déductible dépasse", () => {
    const l = liquiderTva([{ compte: "4431", libelle: "", solde: -20_000 }, { compte: "4452", libelle: "", solde: 50_000 }], 5_000);
    expect(l.aPayer).toBe(0);
    expect(l.creditReporte).toBe(35_000);
    const e = ecritureLiquidationTva({ mois: "2026-09", date: "2026-09-30", soldes: [{ compte: "4431", libelle: "", solde: -20_000 }, { compte: "4452", libelle: "", solde: 50_000 }], liquidation: l });
    expect(e && estEquilibree(e)).toBe(true);
    expect(ligne(e!, "4449")).toBeDefined();
  });

  it("ne passe rien sur un mois vide et paie depuis la trésorerie", () => {
    expect(ecritureLiquidationTva({ mois: "2026-09", date: "2026-09-30", soldes: [], liquidation: liquiderTva([], 0) })).toBeNull();
    const p = ecriturePaiementTva({ mois: "2026-09", date: "2026-10-12", montant: 116_000, tresorerie: { numero: "5211", libelle: "Banque", journal: "BQ" } });
    expect(ligne(p, "4441")?.debit).toBe(116_000);
    expect(() => ecriturePaiementTva({ mois: "2026-09", date: "2026-10-12", montant: 0, tresorerie: { numero: "5211", libelle: "Banque", journal: "BQ" } })).toThrow();
    expect(echeanceTva("2026-12")).toBe("2027-01-15");
  });
});

describe("clôture d'exercice", () => {
  it("solde la gestion et porte le bénéfice en 131", () => {
    const soldes = [
      { compte: "701", libelle: "Ventes", solde: -1_000_000 },
      { compte: "601", libelle: "Achats", solde: 600_000 },
      { compte: "661", libelle: "Salaires", solde: 150_000 },
      { compte: "5211", libelle: "Banque", solde: 400_000 },
    ];
    expect(resultatExercice(soldes)).toBe(250_000);
    const e = ecritureCloture({ exercice: "2025", soldes });
    expect(estEquilibree(e)).toBe(true);
    expect(ligne(e, "131")?.credit).toBe(250_000);
    expect(ligne(e, "5211")).toBeUndefined();
    expect(e.date).toBe("2025-12-31");
  });

  it("porte une perte en 139", () => {
    const e = ecritureCloture({ exercice: "2025", soldes: [{ compte: "701", libelle: "", solde: -100 }, { compte: "601", libelle: "", solde: 300 }] });
    expect(ligne(e, "139")?.debit).toBe(200);
  });

  it("refuse l'exercice en cours ou déjà clos", () => {
    expect(refusCloture("2026", "2026-10-04", false)).toMatch(/pas terminé/);
    expect(refusCloture("2025", "2026-10-04", true)).toMatch(/déjà/);
    expect(refusCloture("2025", "2026-10-04", false)).toBeNull();
  });

  it("refuse tant que le précédent est ouvert ou que la TVA de l'année n'est pas déclarée", () => {
    expect(refusCloture("2025", "2026-10-04", false, { exercicePrecedentOuvert: "2024" })).toMatch(/2024/);
    expect(refusCloture("2025", "2026-10-04", false, { moisTvaEnAttente: ["2025-12"] })).toMatch(/2025-12/);
    expect(refusCloture("2025", "2026-10-04", false, { moisTvaEnAttente: ["2025-11", "2025-12"] })).toMatch(/2 mois/);
  });
});

describe("calendrier de la TVA", () => {
  const mvt = (collectee: number, deductible: number): SoldeTva[] => [
    { compte: "4431", libelle: "TVA facturée", solde: -collectee },
    { compte: "4451", libelle: "TVA récupérable", solde: deductible },
  ];
  const declaree = (mois: string, l: ReturnType<typeof liquiderTva>, payeeLe: string | null = null): DeclarationConnue => ({ mois, ...l, payeeLe });

  it("va du premier mouvement au mois en cours, néant compris, et chaîne le crédit", () => {
    const mouvements = new Map([
      ["2026-06", mvt(10_000, 30_000)],
      ["2026-08", mvt(50_000, 5_000)],
    ]);
    const c = obligationsTva(mouvements, [], "2026-10", "2026-10-05");
    expect(c.map((o) => o.mois)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    // Juin dégage 20 000 de crédit, juillet (néant) le transmet, août l'impute.
    expect(c[0].liquidation.creditReporte).toBe(20_000);
    expect(c[1].liquidation.creditReporte).toBe(20_000);
    expect(c[2].liquidation).toMatchObject({ creditAnterieur: 20_000, aPayer: 25_000 });
    expect(c.map((o) => o.statut)).toEqual(["en_retard", "en_retard", "en_retard", "a_declarer", "en_cours"]);
    // Seul le plus ancien se déclare.
    expect(c.map((o) => o.declarable)).toEqual([true, false, false, false, false]);
  });

  it("prend les montants figés d'une déclaration déposée, payée ou non", () => {
    const mouvements = new Map([
      ["2026-08", mvt(50_000, 5_000)],
      ["2026-09", mvt(10_000, 0)],
    ]);
    const aout = declaree("2026-08", liquiderTva(mouvements.get("2026-08")!, 0));
    let c = obligationsTva(mouvements, [aout], "2026-10", "2026-10-05");
    expect(c[0]).toMatchObject({ statut: "a_payer", declaree: true, enRetard: true });
    expect(c[1]).toMatchObject({ statut: "a_declarer", declarable: true, enRetard: false });

    c = obligationsTva(mouvements, [{ ...aout, payeeLe: "2026-09-10" }], "2026-10", "2026-10-05");
    expect(c[0].statut).toBe("payee");
    // Une écriture arrivée après coup ne change pas ce qui a été déposé.
    c = obligationsTva(new Map([["2026-08", mvt(999_999, 0)]]), [aout], "2026-09", "2026-09-05");
    expect(c[0].liquidation.aPayer).toBe(45_000);
  });

  it("refuse un mois non terminé, déjà déclaré ou hors de l'ordre", () => {
    const mouvements = new Map([
      ["2026-07", mvt(1_000, 0)],
      ["2026-08", mvt(1_000, 0)],
    ]);
    const c = obligationsTva(mouvements, [], "2026-10", "2026-10-05");
    expect(refusDeclarationTva("2026-10", c, "2026-10")).toMatch(/pas terminé/);
    expect(refusDeclarationTva("2026-08", c, "2026-10")).toMatch(/2026-07/);
    expect(refusDeclarationTva("2026-05", c, "2026-10")).toMatch(/rien à déclarer/);
    expect(refusDeclarationTva("2026-07", c, "2026-10")).toBeNull();
    const apres = obligationsTva(mouvements, [declaree("2026-07", liquiderTva(mouvements.get("2026-07")!, 0))], "2026-10", "2026-10-05");
    expect(refusDeclarationTva("2026-07", apres, "2026-10")).toMatch(/déjà/);
    expect(refusDeclarationTva("2026-08", apres, "2026-10")).toBeNull();
  });

  it("passe d'une année à l'autre", () => {
    expect(moisSuivant("2026-12")).toBe("2027-01");
    expect(moisSuivant("2026-09")).toBe("2026-10");
  });
});

describe("verrous de période", () => {
  it("ferme l'exercice clos à tout, le mois déclaré à la seule TVA", () => {
    const base = { exercice: "2026", mois: "2026-09", exerciceClos: false, toucheTva: false, tvaDeclaree: false };
    expect(refusPeriodeVerrouillee(base)).toBeNull();
    expect(refusPeriodeVerrouillee({ ...base, exerciceClos: true })).toMatch(/clôturé/);
    expect(refusPeriodeVerrouillee({ ...base, tvaDeclaree: true })).toBeNull();
    expect(refusPeriodeVerrouillee({ ...base, tvaDeclaree: true, toucheTva: true })).toMatch(/déjà déclarée/);
    expect(toucheTva(["701", "4431", "571"])).toBe(true);
    expect(toucheTva(["4441", "5211"])).toBe(false);
  });

  it("la TVA due du bilan reste juste après liquidation et après paiement", () => {
    const solde = (compte: string, debit: number, credit: number) => ({ compte, libelle: compte, debit, credit });
    const avant = [solde("4431", 0, 180_000), solde("4451", 54_000, 0)];
    expect(positionComptable(avant).tvaDue).toBe(126_000);
    const liquidee = [solde("4431", 180_000, 180_000), solde("4451", 54_000, 54_000), solde("4441", 0, 126_000)];
    expect(positionComptable(liquidee).tvaDue).toBe(126_000);
    expect(positionComptable([...liquidee.slice(0, 2), solde("4441", 126_000, 126_000)]).tvaDue).toBe(0);
    expect(positionComptable([solde("4449", 35_000, 0)]).tvaDue).toBe(-35_000);
  });
});
