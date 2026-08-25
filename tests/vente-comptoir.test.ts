import { describe, expect, it } from "vitest";

import {
  decomposerTTC,
  ecritureVenteComptoir,
  estEquilibree,
  totalCredit,
  totalDebit,
  type PieceComptoir,
} from "@/lib/comptabilite/ecritures";

/**
 * Écriture d'un ticket de caisse.
 *
 * C'est le calcul le plus exposé du produit : il tourne à chaque encaissement,
 * et une erreur y fausse à la fois le chiffre d'affaires, la TVA à reverser et
 * le fonds de caisse compté le soir.
 */

function ticket(valeurs: Partial<PieceComptoir> = {}): PieceComptoir {
  return {
    numero: "C01-000042",
    date: "2026-08-25",
    client: "Client au comptoir",
    lignes: [
      {
        montantTTC: 900,
        tauxTvaBp: 1800,
        compte: "701",
        libelleCompte: "Ventes de marchandises",
      },
    ],
    reglements: [{ moyen: "especes", montant: 900 }],
    ...valeurs,
  };
}

describe("decomposerTTC", () => {
  it("extrait la taxe au lieu de l'ajouter", () => {
    // Un article marqué 300 F s'encaisse 300 F, pas 354.
    const { ht, tva } = decomposerTTC(300, 18);
    expect(ht + tva).toBe(300);
    expect(ht).toBe(254);
  });

  it("retombe toujours exactement sur le TTC encaissé", () => {
    for (const montant of [1, 85, 300, 2900, 123_457]) {
      const { ht, tva } = decomposerTTC(montant, 18);
      expect(ht + tva).toBe(montant);
    }
  });

  it("laisse un exonéré intact", () => {
    expect(decomposerTTC(2600, 0)).toEqual({ ht: 2600, tva: 0 });
  });
});

describe("ecritureVenteComptoir", () => {
  it("équilibre le ticket le plus simple", () => {
    const ecriture = ecritureVenteComptoir(ticket());
    expect(estEquilibree(ecriture)).toBe(true);
    expect(totalDebit(ecriture)).toBe(900);
    expect(totalCredit(ecriture)).toBe(900);
    expect(ecriture.journal).toBe("CA");
  });

  it("débite la trésorerie et crédite produit puis TVA", () => {
    const ecriture = ecritureVenteComptoir(ticket());
    const comptes = ecriture.lignes.map((ligne) => ligne.compte);

    // Le débit vient en tête : on lit d'abord ce qui est entré.
    expect(comptes[0]).toBe("571");
    expect(comptes).toContain("701");
    expect(comptes).toContain("4431");
  });

  it("sépare marchandise et service, qui ne se ventilent pas ensemble", () => {
    const ecriture = ecritureVenteComptoir(
      ticket({
        lignes: [
          { montantTTC: 900, tauxTvaBp: 1800, compte: "701", libelleCompte: "Marchandises" },
          { montantTTC: 1000, tauxTvaBp: 1800, compte: "706", libelleCompte: "Services" },
        ],
        reglements: [{ moyen: "especes", montant: 1900 }],
      }),
    );

    const produits = ecriture.lignes.filter((ligne) => ligne.credit > 0);
    expect(produits.map((ligne) => ligne.compte)).toEqual(
      expect.arrayContaining(["701", "706", "4431"]),
    );
    expect(estEquilibree(ecriture)).toBe(true);
  });

  it("sépare aussi deux taux sur un même compte", () => {
    // Une facture peut mélanger les régimes : le riz local est exonéré, l'eau
    // minérale non. Les fondre rendrait la déclaration de TVA infaisable.
    const ecriture = ecritureVenteComptoir(
      ticket({
        lignes: [
          { montantTTC: 1180, tauxTvaBp: 1800, compte: "701", libelleCompte: "Marchandises" },
          { montantTTC: 2600, tauxTvaBp: 0, compte: "701", libelleCompte: "Marchandises" },
        ],
        reglements: [{ moyen: "especes", montant: 3780 }],
      }),
    );

    const surCompte701 = ecriture.lignes.filter((ligne) => ligne.compte === "701");
    expect(surCompte701).toHaveLength(2);
    expect(estEquilibree(ecriture)).toBe(true);
  });

  it("ventile un paiement mixte sur chaque compte de trésorerie", () => {
    const ecriture = ecritureVenteComptoir(
      ticket({
        lignes: [
          { montantTTC: 5000, tauxTvaBp: 1800, compte: "701", libelleCompte: "Marchandises" },
        ],
        reglements: [
          { moyen: "especes", montant: 2000 },
          { moyen: "mobile_money", montant: 2000 },
          { moyen: "carte", montant: 1000 },
        ],
      }),
    );

    const debits = ecriture.lignes.filter((ligne) => ligne.debit > 0);
    expect(debits.map((ligne) => ligne.compte)).toEqual(["571", "5711", "521"]);
    expect(estEquilibree(ecriture)).toBe(true);
  });

  it("laisse la part à crédit en 411, jamais en trésorerie", () => {
    const ecriture = ecritureVenteComptoir(
      ticket({
        compteAuxiliaire: "411003",
        lignes: [
          { montantTTC: 5000, tauxTvaBp: 1800, compte: "701", libelleCompte: "Marchandises" },
        ],
        reglements: [
          { moyen: "especes", montant: 2000 },
          { moyen: "credit", montant: 3000 },
        ],
      }),
    );

    const creance = ecriture.lignes.find((ligne) => ligne.compte === "411");
    expect(creance?.debit).toBe(3000);
    expect(creance?.auxiliaire).toBe("411003");
  });

  it("refuse une part à crédit sans compte client", () => {
    expect(() =>
      ecritureVenteComptoir(
        ticket({
          reglements: [
            { moyen: "especes", montant: 400 },
            { moyen: "credit", montant: 500 },
          ],
        }),
      ),
    ).toThrow(/compte client/);
  });

  it("refuse un ticket dont les règlements ne couvrent pas le total", () => {
    // Une caisse ne se ferme pas sur un écart : mieux vaut un refus bruyant
    // qu'un fonds de caisse faux découvert au comptage du soir.
    expect(() =>
      ecritureVenteComptoir(
        ticket({ reglements: [{ moyen: "especes", montant: 500 }] }),
      ),
    ).toThrow(/totalisent/);
  });

  it("reste équilibré sur des montants qui ne tombent pas ronds", () => {
    for (const montant of [1, 7, 85, 333, 99_999]) {
      const ecriture = ecritureVenteComptoir(
        ticket({
          lignes: [
            { montantTTC: montant, tauxTvaBp: 1800, compte: "701", libelleCompte: "M" },
          ],
          reglements: [{ moyen: "especes", montant }],
        }),
      );
      expect(estEquilibree(ecriture)).toBe(true);
      expect(totalDebit(ecriture)).toBe(montant);
    }
  });
});
