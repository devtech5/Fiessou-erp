import { describe, expect, it } from "vitest";

import { CATEGORIES_DEPENSE } from "@/modules/projets/calcul";
import { NATURES_BON } from "@/modules/tresorerie/calcul";
import {
  consommationBudget,
  echeancesCharge,
  equivalentMensuel,
  evolutionBp,
  familleDuCompte,
  moisGlissants,
  moisPrecedent,
  moisSuivant,
  moyenneMensuelle,
  prochaineEcheance,
  regrouperCharges,
} from "@/modules/tresorerie/charges";

describe("familles de charges", () => {
  it("range un compte dans la famille au préfixe le plus long", () => {
    expect(familleDuCompte("6052")).toBe("energie");
    expect(familleDuCompte("6042")).toBe("energie");
    expect(familleDuCompte("605")).toBe("fournitures");
    expect(familleDuCompte("601")).toBe("marchandises");
    expect(familleDuCompte("622")).toBe("loyers");
    expect(familleDuCompte("6276")).toBe("services");
    expect(familleDuCompte("631")).toBe("services");
    expect(familleDuCompte("632")).toBe("honoraires");
    expect(familleDuCompte("661")).toBe("personnel");
    expect(familleDuCompte("658")).toBe("autres");
  });

  it("ignore ce qui n'est pas une charge", () => {
    expect(familleDuCompte("701")).toBeNull();
    expect(familleDuCompte("4452")).toBeNull();
    expect(familleDuCompte("571")).toBeNull();
  });

  it("toute nature de dépense ou de bon de caisse tombe dans une famille", () => {
    for (const c of [...Object.values(CATEGORIES_DEPENSE), ...Object.values(NATURES_BON)]) {
      expect(familleDuCompte(c.compte)).not.toBeNull();
    }
  });
});

describe("mois", () => {
  it("compte douze mois glissants à travers le changement d'année", () => {
    expect(moisGlissants("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(moisPrecedent("2026-01")).toBe("2025-12");
    expect(moisSuivant("2025-12")).toBe("2026-01");
  });
});

describe("regroupement", () => {
  const mois = ["2026-09", "2026-10"];

  it("additionne par famille et par mois, et ignore le reste", () => {
    const r = regrouperCharges(
      [
        { mois: "2026-10", compte: "622", montant: 150_000 },
        { mois: "2026-10", compte: "6052", montant: 42_500 },
        { mois: "2026-09", compte: "6052", montant: 38_000 },
        // Un avoir fournisseur vient en déduction.
        { mois: "2026-10", compte: "6052", montant: -2_500 },
        // Hors période, hors classe 6 : ignorés.
        { mois: "2026-08", compte: "622", montant: 150_000 },
        { mois: "2026-10", compte: "701", montant: 999_999 },
      ],
      mois,
    );
    expect(r.parMois).toEqual({ "2026-09": 38_000, "2026-10": 190_000 });
    expect(r.total).toBe(228_000);
    // Ordre d'affichage, pas ordre d'arrivée.
    expect(r.familles.map((f) => f.famille)).toEqual(["energie", "loyers"]);
    expect(r.familles[0].parMois["2026-10"]).toBe(40_000);
  });

  it("la somme des familles retombe sur le total du mois", () => {
    const r = regrouperCharges(
      [
        { mois: "2026-10", compte: "601", montant: 1_234_567 },
        { mois: "2026-10", compte: "6181", montant: 7_001 },
        { mois: "2026-10", compte: "661", montant: 850_000 },
      ],
      mois,
    );
    expect(r.familles.reduce((s, f) => s + f.parMois["2026-10"], 0)).toBe(r.parMois["2026-10"]);
  });
});

describe("indicateurs en entiers", () => {
  it("moyenne et évolution ne produisent jamais de virgule", () => {
    expect(moyenneMensuelle([100, 100, 101])).toBe(100);
    expect(Number.isInteger(moyenneMensuelle([1, 2]))).toBe(true);
    expect(evolutionBp(112_500, 100_000)).toBe(1_250);
    expect(evolutionBp(80_000, 100_000)).toBe(-2_000);
    expect(evolutionBp(50_000, 0)).toBeNull();
  });

  it("un budget se juge dedans, proche ou dépassé", () => {
    expect(consommationBudget(50_000, null)).toEqual({ bp: null, etat: "sans_budget" });
    expect(consommationBudget(50_000, 100_000)).toEqual({ bp: 5_000, etat: "dans_le_budget" });
    expect(consommationBudget(95_000, 100_000).etat).toBe("proche");
    expect(consommationBudget(100_000, 100_000).etat).toBe("proche");
    expect(consommationBudget(100_001, 100_000).etat).toBe("depasse");
  });
});

describe("charges récurrentes", () => {
  it("garde le jour d'échéance, ramené au dernier jour des mois courts", () => {
    const loyer = { premiereEcheance: "2026-01-31", periodicite: "mensuelle" as const };
    expect(echeancesCharge(loyer, "2026-04-30").map((e) => e.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(echeancesCharge({ premiereEcheance: "2028-01-31", periodicite: "mensuelle" }, "2028-02-29")[1].date).toBe("2028-02-29");
  });

  it("espace les échéances selon la périodicité", () => {
    expect(echeancesCharge({ premiereEcheance: "2026-11-15", periodicite: "trimestrielle" }, "2027-08-31").map((e) => e.periode)).toEqual([
      "2026-11",
      "2027-02",
      "2027-05",
      "2027-08",
    ]);
    expect(echeancesCharge({ premiereEcheance: "2026-03-01", periodicite: "annuelle" }, "2028-03-01")).toHaveLength(3);
  });

  it("la prochaine échéance est la première non traitée, retard compris", () => {
    const internet = { premiereEcheance: "2026-09-05", periodicite: "mensuelle" as const };
    expect(prochaineEcheance(internet, new Set(), "2026-10-06")).toEqual({ periode: "2026-09", date: "2026-09-05" });
    expect(prochaineEcheance(internet, new Set(["2026-09", "2026-10"]), "2026-10-06")).toEqual({ periode: "2026-11", date: "2026-11-05" });
  });

  it("ramène une charge espacée à son poids mensuel", () => {
    expect(equivalentMensuel(120_000, "annuelle")).toBe(10_000);
    expect(equivalentMensuel(100_000, "trimestrielle")).toBe(33_333);
    expect(equivalentMensuel(45_000, "mensuelle")).toBe(45_000);
  });
});
