import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import {
  CATEGORIES_DEPENSE,
  categorieConnue,
  depasseBudget,
  ecritureDepense,
  refusApprobation,
  suiviBudget,
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
