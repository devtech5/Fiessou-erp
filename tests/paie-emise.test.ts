import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import { presetRole, resoudreDroits } from "@/lib/droits/catalogue";
import { alertes } from "@/lib/tableau-de-bord";
import {
  BAREME_PAR_DEFAUT,
  calculerBulletinPaie,
  echeanceDeclarations,
  ecriturePaie,
  ecriturePaiementSalaire,
  ecritureVersement,
  finDeMois,
  impotProgressif,
  libelleMois,
  moisValide,
  refusBareme,
  totaliser,
  type BaremePaie,
} from "@/modules/paie/calcul";

const bareme: BaremePaie = {
  cnpsRetraiteSalarieBp: 630,
  cnpsRetraitePatronalBp: 770,
  cnpsPlafondMensuel: 1_000_000,
  prestationsFamilialesBp: 575,
  accidentTravailBp: 200,
  tranchesImpot: [
    { seuil: 75_000, tauxBp: 150 },
    { seuil: 240_000, tauxBp: 500 },
  ],
};
const ligne = (e: { lignes: { compte: string; debit: number; credit: number }[] }, compte: string) => e.lignes.find((l) => l.compte === compte);

describe("impôt progressif", () => {
  it("ne taxe chaque tranche que pour sa part", () => {
    expect(impotProgressif(50_000, bareme.tranchesImpot)).toBe(0);
    expect(impotProgressif(175_000, bareme.tranchesImpot)).toBe(1_500); // 100 000 × 1,5 %
    expect(impotProgressif(340_000, bareme.tranchesImpot)).toBe(2_475 + 5_000); // 165 000 × 1,5 % + 100 000 × 5 %
  });

  it("ne dépend pas de l'ordre de saisie des tranches", () => {
    expect(impotProgressif(340_000, [...bareme.tranchesImpot].reverse())).toBe(7_475);
  });
});

describe("bulletin", () => {
  it("suit la cascade brut, CNPS, impôt, indemnités, retenues", () => {
    const b = calculerBulletinPaie({ salaireBase: 200_000, primesImposables: 50_000, indemnitesNonImposables: 25_000, retenuesDiverses: 10_000 }, bareme);
    expect(b.brut).toBe(250_000);
    expect(b.cnpsSalarie).toBe(15_750);
    expect(b.baseImposable).toBe(234_250);
    expect(b.impot).toBe(impotProgressif(234_250, bareme.tranchesImpot));
    expect(b.net).toBe(250_000 - 15_750 - b.impot + 25_000 - 10_000);
    expect(b.cnpsPatronal).toBe(19_250);
    expect(b.prestationsFamiliales).toBe(14_375);
    expect(b.accidentTravail).toBe(5_000);
    expect(b.coutTotal).toBe(250_000 + 25_000 + 19_250 + 14_375 + 5_000);
  });

  it("plafonne la retraite, pas les prestations familiales", () => {
    const b = calculerBulletinPaie({ salaireBase: 2_000_000, primesImposables: 0, indemnitesNonImposables: 0, retenuesDiverses: 0 }, bareme);
    expect(b.assietteCnps).toBe(1_000_000);
    expect(b.cnpsSalarie).toBe(63_000);
    expect(b.prestationsFamiliales).toBe(115_000);
  });

  it("refuse un net négatif et des montants faux", () => {
    expect(() => calculerBulletinPaie({ salaireBase: 60_000, primesImposables: 0, indemnitesNonImposables: 0, retenuesDiverses: 80_000 }, bareme)).toThrow(/négatif/);
    expect(() => calculerBulletinPaie({ salaireBase: 60_000.5, primesImposables: 0, indemnitesNonImposables: 0, retenuesDiverses: 0 }, bareme)).toThrow();
  });
});

describe("écritures de paie", () => {
  const bulletins = [
    { ...calculerBulletinPaie({ salaireBase: 200_000, primesImposables: 50_000, indemnitesNonImposables: 25_000, retenuesDiverses: 10_000 }, bareme), indemnitesNonImposables: 25_000, retenuesDiverses: 10_000 },
    { ...calculerBulletinPaie({ salaireBase: 120_000, primesImposables: 0, indemnitesNonImposables: 0, retenuesDiverses: 0 }, bareme), indemnitesNonImposables: 0, retenuesDiverses: 0 },
  ];
  const t = totaliser(bulletins);

  it("passe une écriture de paie équilibrée au journal OD", () => {
    const e = ecriturePaie({ mois: "2026-10", date: finDeMois("2026-10"), totaux: t, salaries: 2 });
    expect(estEquilibree(e)).toBe(true);
    expect(e.journal).toBe("OD");
    expect(e.date).toBe("2026-10-31");
    expect(ligne(e, "661")?.debit).toBe(370_000);
    expect(ligne(e, "663")?.debit).toBe(25_000);
    expect(ligne(e, "664")?.debit).toBe(t.chargesPatronales);
    expect(ligne(e, "431")?.credit).toBe(t.totalCnps);
    expect(ligne(e, "447")?.credit).toBe(t.impot);
    expect(ligne(e, "4251")?.credit).toBe(10_000);
    expect(ligne(e, "422")?.credit).toBe(t.net);
  });

  it("verse le net et les organismes depuis la trésorerie", () => {
    const tres = { numero: "5211", libelle: "SGBCI", journal: "BQ" as const };
    const p = ecriturePaiementSalaire({ piece: "BUL-1-P", date: "2026-11-02", salarie: "Koné", montant: 150_000, tresorerie: tres });
    expect(ligne(p, "422")?.debit).toBe(150_000);
    expect(ligne(p, "5211")?.credit).toBe(150_000);
    const v = ecritureVersement({ organisme: "cnps", piece: "CNPS-2026-10", date: "2026-11-10", mois: "2026-10", montant: t.totalCnps, tresorerie: tres });
    expect(ligne(v, "431")?.debit).toBe(t.totalCnps);
    const i = ecritureVersement({ organisme: "impot", piece: "ITS-2026-10", date: "2026-11-10", mois: "2026-10", montant: t.impot, tresorerie: tres });
    expect(ligne(i, "447")?.debit).toBe(t.impot);
    expect(() => ecritureVersement({ organisme: "impot", piece: "x", date: "2026-11-10", mois: "2026-10", montant: 0, tresorerie: tres })).toThrow();
  });
});

describe("barème et calendrier", () => {
  it("contrôle un barème saisi", () => {
    expect(refusBareme(BAREME_PAR_DEFAUT)).toBeNull();
    expect(refusBareme({ ...bareme, cnpsRetraiteSalarieBp: 6_000 })).toMatch(/entre 0 et 50/);
    expect(refusBareme({ ...bareme, cnpsPlafondMensuel: 0 })).toMatch(/plafond/);
    expect(refusBareme({ ...bareme, tranchesImpot: [{ seuil: 1, tauxBp: 100 }, { seuil: 1, tauxBp: 200 }] })).toMatch(/même seuil/);
  });

  it("calcule les dates de la période", () => {
    expect(moisValide("2026-10")).toBe(true);
    expect(moisValide("2026-13")).toBe(false);
    expect(libelleMois("2026-02")).toBe("février 2026");
    expect(finDeMois("2028-02")).toBe("2028-02-29");
    expect(echeanceDeclarations("2026-12")).toBe("2027-01-15");
  });
});

describe("branchements de la paie", () => {
  it("lève les alertes de paie", () => {
    const liste = alertes(
      { enRetard: 0, montantEnRetard: 0 },
      { ruptures: 0, aCommanderVite: 0, valeur: 0 },
      { echeancesDepassees: 0, indisponibles: 0 },
      { enRetard: 0, echouees: 0 },
      { locationsEnRetard: 0, abonnementsEpuises: 0 },
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      { salairesNonPayes: 3, montantNonPaye: 450_000, declarationsDues: 2, montantDeclarations: 120_000, declarationsEchues: 1 },
    );
    expect(liste.find((a) => a.id === "salaires-non-payes")?.gravite).toBe("critique");
    expect(liste.find((a) => a.id === "declarations-paie")?.gravite).toBe("critique");
  });

  it("réserve la validation au gérant, la préparation et le paiement au comptable", () => {
    const comptable = resoudreDroits({ cleRole: "comptable", estProprietaire: false });
    expect(comptable.has("personnes.paie.preparer")).toBe(true);
    expect(comptable.has("personnes.paie.payer")).toBe(true);
    expect(comptable.has("personnes.paie.valider")).toBe(false);
    expect(presetRole("gerant")?.droits).toContain("personnes.paie.valider");
  });
});
