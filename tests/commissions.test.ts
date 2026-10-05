import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import { atteinteObjectif, bornesMois, calculerCommission, ecriturePaiementCommission, partVariable, refusRegle } from "@/modules/commerciaux/calcul";

describe("part variable", () => {
  it("taux unique", () => {
    expect(partVariable(1_250_000, { tauxBp: 500, paliers: null })).toBe(62_500);
    expect(partVariable(-10_000, { tauxBp: 500, paliers: null })).toBe(0);
  });

  it("paliers progressifs : chaque taux sur sa seule tranche", () => {
    const paliers = [
      { seuil: 0, tauxBp: 300 },
      { seuil: 2_000_000, tauxBp: 500 },
      { seuil: 5_000_000, tauxBp: 700 },
    ];
    expect(partVariable(1_000_000, { tauxBp: 0, paliers })).toBe(30_000);
    // 2 M à 3 % + 1 M à 5 %
    expect(partVariable(3_000_000, { tauxBp: 0, paliers })).toBe(60_000 + 50_000);
    // 2 M à 3 % + 3 M à 5 % + 1 M à 7 %
    expect(partVariable(6_000_000, { tauxBp: 0, paliers })).toBe(60_000 + 150_000 + 70_000);
    // Franchir un palier ne fait jamais baisser la commission.
    expect(partVariable(2_000_001, { tauxBp: 0, paliers })).toBeGreaterThanOrEqual(partVariable(2_000_000, { tauxBp: 0, paliers }));
  });
});

describe("commission du mois", () => {
  it("additionne le fixe et le variable, sur la base choisie", () => {
    const r = { tauxBp: 1_000, paliers: null, fixeMensuel: 50_000 };
    expect(calculerCommission({ caHt: 2_000_000, marge: 600_000 }, { ...r, base: "ca_ht" })).toEqual({ assiette: 2_000_000, variable: 200_000, fixe: 50_000, total: 250_000 });
    expect(calculerCommission({ caHt: 2_000_000, marge: 600_000 }, { ...r, base: "marge" }).total).toBe(110_000);
    // Mois sans vente : le fixe reste dû.
    expect(calculerCommission({ caHt: 0, marge: 0 }, { ...r, base: "ca_ht" }).total).toBe(50_000);
  });

  it("refuse les règles incohérentes", () => {
    const r = { base: "ca_ht" as const, tauxBp: 500, paliers: null, fixeMensuel: 0 };
    expect(refusRegle(r)).toBeNull();
    expect(refusRegle({ ...r, tauxBp: 12_000 })).toMatch(/100 %/);
    expect(refusRegle({ ...r, paliers: [{ seuil: 1000, tauxBp: 300 }] })).toMatch(/part de 0/);
    expect(refusRegle({ ...r, paliers: [{ seuil: 0, tauxBp: 300 }, { seuil: 0, tauxBp: 500 }] })).toMatch(/Deux paliers/);
  });

  it("mesure l'objectif et borne le mois", () => {
    expect(atteinteObjectif(1_500_000, 2_000_000)).toBe(7_500);
    expect(atteinteObjectif(1_500_000, 0)).toBeNull();
    expect(bornesMois("2026-12")).toEqual({ du: "2026-12-01", au: "2027-01-01" });
  });

  it("paie un externe par une écriture équilibrée en 6322", () => {
    const e = ecriturePaiementCommission({ piece: "COM-2026-10-0001", date: "2026-11-05", commercial: "Koffi", mois: "2026-10", montant: 110_000, tresorerie: { numero: "5211", libelle: "Banque", journal: "BQ" } });
    expect(estEquilibree(e)).toBe(true);
    expect(e.lignes[0]).toMatchObject({ compte: "6322", debit: 110_000 });
  });
});
