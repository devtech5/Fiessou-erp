import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import {
  ecritureCloture,
  ecritureLiquidationTva,
  ecriturePaiementTva,
  echeanceTva,
  finDeMois,
  liquiderTva,
  refusCloture,
  resultatExercice,
} from "@/modules/fiscalite/calcul";

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
});
