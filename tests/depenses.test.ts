import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import {
  bilanProjet,
  CATEGORIES_DEPENSE,
  categorieConnue,
  depasseBudget,
  ecritureDepense,
  refusApprobation,
  suiviBudget,
  tauxReussitePortefeuille,
  transitionDepense,
} from "@/modules/projets/calcul";

describe("circuit d'une dépense", () => {
  it("passe de la demande au paiement, jamais à rebours", () => {
    expect(transitionDepense("demandee", "approuvee")).toBe(true);
    expect(transitionDepense("approuvee", "payee")).toBe(true);
    expect(transitionDepense("demandee", "payee")).toBe(false);
    expect(transitionDepense("payee", "annulee")).toBe(false);
    expect(transitionDepense("rejetee", "approuvee")).toBe(false);
  });

  it("refuse qu'on approuve sa propre demande, sauf au propriétaire", () => {
    expect(refusApprobation("u1", "u1", false)).toMatch(/propre demande/);
    expect(refusApprobation("u1", "u1", true)).toBeNull();
    expect(refusApprobation("u1", "u2", false)).toBeNull();
  });

  it("ne connaît que les natures du plan de comptes", () => {
    expect(categorieConnue("materiaux")).toBe(true);
    expect(categorieConnue("cadeaux")).toBe(false);
  });
});

describe("budget du projet", () => {
  const depenses = [
    { statut: "payee" as const, montant: 300_000 },
    { statut: "approuvee" as const, montant: 150_000 },
    { statut: "demandee" as const, montant: 80_000 },
    { statut: "rejetee" as const, montant: 999_000 },
  ];

  it("engage l'approuvé et le payé, pas la simple demande", () => {
    const s = suiviBudget(1_000_000, depenses);
    expect(s).toEqual({ engage: 450_000, paye: 300_000, enAttente: 80_000, reste: 550_000, taux: 45 });
  });

  it("sans budget, ni reste ni taux", () => {
    const s = suiviBudget(null, depenses);
    expect(s.reste).toBeNull();
    expect(s.taux).toBeNull();
  });

  it("signale le dépassement au franc près", () => {
    expect(depasseBudget(500_000, 450_000, 50_000)).toBe(false);
    expect(depasseBudget(500_000, 450_000, 50_001)).toBe(true);
    expect(depasseBudget(null, 10_000_000, 1)).toBe(false);
  });
});

describe("écriture de paiement", () => {
  const base = {
    numero: "DPS-2026-00001",
    date: "2026-10-04",
    objet: "Ciment CPJ 45 — 40 sacs",
    categorie: "materiaux" as const,
    montant: 236_000,
    tauxTvaBp: 1800,
    moyen: "especes" as const,
    projet: "PRJ-2026-001 · Boutique Yopougon",
  };

  it("passe la charge HT, la TVA récupérable et sort la trésorerie", () => {
    const e = ecritureDepense(base);
    expect(estEquilibree(e)).toBe(true);
    expect(e.lignes).toEqual([
      { compte: "604", libelleCompte: CATEGORIES_DEPENSE.materiaux.libelleCompte, debit: 200_000, credit: 0 },
      { compte: "4451", libelleCompte: "TVA récupérable sur achats", debit: 36_000, credit: 0 },
      { compte: "571", libelleCompte: "Caisse", debit: 0, credit: 236_000 },
    ]);
    expect(e.libelle).toContain("Boutique Yopougon");
  });

  it("sans facture normalisée, tout va en charge", () => {
    const e = ecritureDepense({ ...base, tauxTvaBp: 0, categorie: "main_oeuvre", moyen: "mobile_money" });
    expect(e.lignes.map((l) => l.compte)).toEqual(["637", "5711"]);
    expect(e.lignes[0].debit).toBe(236_000);
  });

  it("un virement passe au journal de banque", () => {
    expect(ecritureDepense({ ...base, moyen: "banque" }).journal).toBe("BQ");
  });
});

describe("bilan d'un projet", () => {
  const base = {
    facture: 0,
    encaisse: 0,
    coutEngage: 0,
    coutPaye: 0,
    prixVente: null,
    budget: null,
    engageTtc: 0,
    finPrevue: null,
    termineLe: null,
  };

  it("donne le bénéfice et la marge sur le facturé, hors taxes", () => {
    const b = bilanProjet({ ...base, facture: 2_400_000, coutEngage: 1_340_000, termineLe: "2026-10-04" }, "2026-10-04");
    expect(b.resultat).toBe(1_060_000);
    expect(b.margeBp).toBe(4417);
  });

  it("donne la perte quand les coûts dépassent la recette", () => {
    const b = bilanProjet({ ...base, facture: 1_000_000, coutEngage: 1_250_000, termineLe: "2026-10-04" }, "2026-10-04");
    expect(b.resultat).toBe(-250_000);
    expect(b.criteres.find((c) => c.cle === "rentabilite")?.atteint).toBe(false);
  });

  it("juge un projet en cours sur son résultat prévu, pas sur sa facturation partielle", () => {
    const b = bilanProjet({ ...base, facture: 1_500_000, coutEngage: 2_381_186, prixVente: 3_000_000 }, "2026-10-04");
    expect(b.resultat).toBe(-881_186);
    expect(b.resultatPrevu).toBe(618_814);
    const rentable = b.criteres.find((c) => c.cle === "rentabilite")!;
    expect(rentable.atteint).toBe(true);
    expect(rentable.libelle).toBe("Rentable au prix convenu");
    // Le reste à facturer n'est pas un échec tant que le projet court.
    expect(b.criteres.some((c) => c.cle === "chiffre")).toBe(false);
    expect(b.ecarts.chiffre).toBe(-1_500_000);
  });

  it("mesure les écarts : budget, chiffre, délai", () => {
    const b = bilanProjet(
      { ...base, facture: 2_400_000, coutEngage: 1_340_000, prixVente: 2_400_000, budget: 1_800_000, engageTtc: 1_538_000, finPrevue: "2026-09-24", termineLe: "2026-10-04" },
      "2026-10-04",
    );
    expect(b.ecarts).toEqual({ budget: 262_000, chiffre: 0, delaiJours: 10 });
    expect(b.criteres.map((c) => [c.cle, c.atteint])).toEqual([
      ["budget", true],
      ["rentabilite", true],
      ["chiffre", true],
      ["delai", false],
    ]);
    expect(b.tauxReussite).toBe(75);
  });

  it("ne juge pas le délai d'un projet en cours avant l'échéance", () => {
    const avant = bilanProjet({ ...base, finPrevue: "2026-10-30" }, "2026-10-04");
    expect(avant.ecarts.delaiJours).toBeNull();
    expect(avant.criteres).toHaveLength(0);
    expect(avant.tauxReussite).toBeNull();
    const apres = bilanProjet({ ...base, finPrevue: "2026-10-01" }, "2026-10-04");
    expect(apres.ecarts.delaiJours).toBe(3);
    expect(apres.criteres[0]).toMatchObject({ cle: "delai", atteint: false });
  });

  it("compte la réussite du portefeuille sur les projets terminés seulement", () => {
    const reussi = bilanProjet({ ...base, facture: 100, coutEngage: 50, termineLe: "2026-10-01" }, "2026-10-04");
    const rate = bilanProjet({ ...base, facture: 100, coutEngage: 150, termineLe: "2026-10-01" }, "2026-10-04");
    const enCours = bilanProjet({ ...base, facture: 100, coutEngage: 500 }, "2026-10-04");
    expect(
      tauxReussitePortefeuille([
        { statut: "termine", bilan: reussi },
        { statut: "termine", bilan: rate },
        { statut: "en_cours", bilan: enCours },
      ]),
    ).toEqual({ evalues: 2, reussis: 1, taux: 50 });
    expect(tauxReussitePortefeuille([{ statut: "en_cours", bilan: enCours }]).taux).toBeNull();
  });
});
