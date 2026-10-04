import { describe, expect, it } from "vitest";

import { estEquilibree, totalDebit } from "@/lib/comptabilite/ecritures";
import {
  commissionIndicative,
  ecritureClotureGuichet,
  effetSurEspeces,
  effetSurFloat,
  rapprocher,
  refusOperation,
  soldes,
  type OperationComptee,
} from "@/modules/monnaie/calcul";

const ouverture = { floats: { wave: 1_000_000, orange: 500_000, mtn: 350_000, moov: 100_000 }, fondCaisse: 250_000 };

const journee: OperationComptee[] = [
  { type: "depot", reseau: "wave", montant: 50_000, commission: 300 },
  { type: "retrait", reseau: "orange", montant: 25_000, commission: 250 },
  { type: "credit", reseau: "mtn", montant: 1_000, commission: 50 },
  { type: "retrait", reseau: "moov", montant: 40_000, commission: 300 },
  { type: "approvisionnement", reseau: "wave", montant: 100_000, commission: 0 },
  // Saisie par erreur puis annulée : elle ne compte plus nulle part.
  { type: "depot", reseau: "orange", montant: 999_000, commission: 9_000, annulee: true },
];

describe("effet des opérations", () => {
  it("fait toujours aller float et espèces en sens contraire", () => {
    for (const type of ["depot", "retrait", "credit", "approvisionnement", "destockage"] as const) {
      expect(effetSurFloat(type, 10_000) + effetSurEspeces(type, 10_000)).toBe(0);
    }
    expect(effetSurFloat("depot", 10_000)).toBe(-10_000);
    expect(effetSurEspeces("retrait", 10_000)).toBe(-10_000);
  });

  it("déduit les soldes de l'ouverture et des opérations", () => {
    const s = soldes(ouverture, journee);
    expect(s.floats).toEqual({ wave: 1_050_000, orange: 525_000, mtn: 349_000, moov: 140_000 });
    expect(s.especes).toBe(250_000 + 50_000 - 25_000 + 1_000 - 40_000 - 100_000);
    expect(s.commissions).toBe(900);
  });

  it("garde l'invariant : float + espèces constant hors commissions", () => {
    const s = soldes(ouverture, journee);
    const avant = Object.values(ouverture.floats).reduce((a, b) => a + b, 0) + ouverture.fondCaisse;
    const apres = Object.values(s.floats).reduce((a, b) => a + b, 0) + s.especes;
    expect(apres).toBe(avant);
  });
});

describe("contrôle avant validation", () => {
  const s = soldes(ouverture, []);

  it("refuse un dépôt que le float ne couvre pas", () => {
    expect(refusOperation(s, { type: "depot", reseau: "moov", montant: 100_001 })).toMatch(/Float Moov Money insuffisant/);
    expect(refusOperation(s, { type: "depot", reseau: "moov", montant: 100_000 })).toBeNull();
  });

  it("refuse un retrait que le tiroir ne couvre pas", () => {
    expect(refusOperation(s, { type: "retrait", reseau: "wave", montant: 250_001 })).toMatch(/Espèces insuffisantes/);
    expect(refusOperation(s, { type: "retrait", reseau: "wave", montant: 250_000 })).toBeNull();
  });

  it("refuse un montant nul, négatif ou fractionnaire", () => {
    expect(refusOperation(s, { type: "depot", reseau: "wave", montant: 0 })).toBe("Montant invalide.");
    expect(refusOperation(s, { type: "depot", reseau: "wave", montant: -5 })).toBe("Montant invalide.");
    expect(refusOperation(s, { type: "depot", reseau: "wave", montant: 10.5 })).toBe("Montant invalide.");
  });
});

describe("commission indicative", () => {
  it("suit le barème par tranche", () => {
    expect(commissionIndicative("depot", 5_000)).toBe(50);
    expect(commissionIndicative("retrait", 5_001)).toBe(100);
    expect(commissionIndicative("depot", 1_000_000)).toBe(1_500);
  });

  it("ne rémunère pas les mouvements de trésorerie de l'agent", () => {
    expect(commissionIndicative("approvisionnement", 500_000)).toBe(0);
    expect(commissionIndicative("destockage", 500_000)).toBe(0);
  });

  it("donne une remise entière sur le crédit", () => {
    expect(commissionIndicative("credit", 1_000)).toBe(50);
    expect(commissionIndicative("credit", 510)).toBe(25);
  });
});

describe("rapprochement et clôture", () => {
  const s = soldes(ouverture, journee);

  it("mesure l'écart compté moins attendu", () => {
    const r = rapprocher(s, s.especes - 2_000, { wave: 1_050_000, orange: null });
    expect(r.ecartEspeces).toBe(-2_000);
    expect(r.floats.find((f) => f.reseau === "wave")?.ecart).toBe(0);
    expect(r.floats.find((f) => f.reseau === "orange")?.ecart).toBeNull();
  });

  const variations = { wave: 50_000, orange: 25_000, mtn: -1_000, moov: 40_000 };

  it("passe une écriture équilibrée, commissions en produit", () => {
    const e = ecritureClotureGuichet({ numero: "GUI-2026-00001", date: "2026-10-04", variationsFloat: variations, commissions: 900, ecartEspeces: 0 })!;
    expect(estEquilibree(e)).toBe(true);
    expect(e.lignes.filter((l) => l.compte === "5712")).toHaveLength(4);
    expect(e.lignes.find((l) => l.compte === "571")?.credit).toBe(114_000);
    expect(e.lignes.find((l) => l.compte === "706")?.credit).toBe(900);
    expect(e.lignes.find((l) => l.compte === "4718")?.debit).toBe(900);
  });

  it("passe un manquant en charge et un excédent en produit", () => {
    const manquant = ecritureClotureGuichet({ numero: "G", date: "2026-10-04", variationsFloat: variations, commissions: 0, ecartEspeces: -2_000 })!;
    expect(estEquilibree(manquant)).toBe(true);
    expect(manquant.lignes.find((l) => l.compte === "658")?.debit).toBe(2_000);
    expect(manquant.lignes.find((l) => l.compte === "571")?.credit).toBe(116_000);

    const excedent = ecritureClotureGuichet({ numero: "G", date: "2026-10-04", variationsFloat: {}, commissions: 0, ecartEspeces: 500 })!;
    expect(estEquilibree(excedent)).toBe(true);
    expect(excedent.lignes.find((l) => l.compte === "758")?.credit).toBe(500);
    expect(totalDebit(excedent)).toBe(500);
  });

  it("ne passe rien pour une journée blanche", () => {
    expect(ecritureClotureGuichet({ numero: "G", date: "2026-10-04", variationsFloat: {}, commissions: 0, ecartEspeces: 0 })).toBeNull();
  });
});
