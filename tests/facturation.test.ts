import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import {
  echeanceDe,
  ecritureDePiece,
  montantHtLigne,
  resteDu,
  totaliserPiece,
  type LigneSaisie,
} from "@/modules/facturation/calcul";

/**
 * Calcul des pièces commerciales.
 *
 * Le point qui compte : le total imprimé sur la facture et l'écriture passée
 * au journal doivent retomber au franc près. Un écart d'un franc par facture
 * se découvre à la déclaration de TVA, des mois plus tard.
 */

function ligne(valeurs: Partial<LigneSaisie> = {}): LigneSaisie {
  return {
    designation: "Riz parfumé 25 kg",
    quantite: 1000,
    prixUnitaireHt: 15_000,
    remise: 0,
    tauxTva: 1800,
    compteVente: "701",
    ...valeurs,
  };
}

describe("montantHtLigne", () => {
  it("multiplie le prix par la quantité en millièmes", () => {
    expect(montantHtLigne(ligne({ quantite: 2500 }))).toBe(37_500);
  });

  it("déduit la remise sans jamais passer sous zéro", () => {
    expect(montantHtLigne(ligne({ remise: 1_000 }))).toBe(14_000);
    expect(montantHtLigne(ligne({ remise: 99_999 }))).toBe(0);
  });
});

describe("totaliserPiece", () => {
  it("ajoute la TVA au hors taxes", () => {
    const totaux = totaliserPiece([ligne()]);
    expect(totaux).toMatchObject({ totalHt: 15_000, totalTva: 2_700, totalTtc: 17_700 });
  });

  it("sépare les taux et retombe sur le total", () => {
    const totaux = totaliserPiece([
      ligne({ prixUnitaireHt: 333 }),
      ligne({ prixUnitaireHt: 260_000, tauxTva: 0 }),
      ligne({ prixUnitaireHt: 30_000, compteVente: "706" }),
    ]);
    expect(totaux.parTaux.map((t) => t.tauxTva)).toEqual([1800, 0]);
    expect(totaux.parTaux.reduce((s, t) => s + t.tva, 0)).toBe(totaux.totalTva);
    expect(totaux.parTaux.reduce((s, t) => s + t.base, 0)).toBe(totaux.totalHt);
    expect(totaux.totalTtc).toBe(totaux.totalHt + totaux.totalTva);
  });

  it("donne exactement le TTC que l'écriture débite au client", () => {
    const lignes = [
      ligne({ prixUnitaireHt: 1_111, quantite: 3_000 }),
      ligne({ prixUnitaireHt: 777, quantite: 1_250, compteVente: "706" }),
      ligne({ prixUnitaireHt: 5_555, tauxTva: 900 }),
    ];
    const totaux = totaliserPiece(lignes);
    const ecriture = ecritureDePiece({
      nature: "facture",
      numero: "FAC-2026-00001",
      date: "2026-10-04",
      client: "Client",
      compteAuxiliaire: "411001",
      lignes,
    });
    expect(estEquilibree(ecriture)).toBe(true);
    expect(ecriture.lignes[0]).toMatchObject({ compte: "411", debit: totaux.totalTtc });
  });

  it("vaut zéro sans ligne", () => {
    expect(totaliserPiece([])).toMatchObject({ totalHt: 0, totalTva: 0, totalTtc: 0 });
  });
});

describe("ecritureDePiece", () => {
  it("inverse l'avoir par rapport à la facture", () => {
    const base = {
      numero: "X",
      date: "2026-10-04",
      client: "Client",
      compteAuxiliaire: "411001",
      lignes: [ligne()],
    };
    const facture = ecritureDePiece({ ...base, nature: "facture" });
    const avoir = ecritureDePiece({ ...base, nature: "avoir" });
    expect(avoir.lignes[0].credit).toBe(facture.lignes[0].debit);
    expect(estEquilibree(avoir)).toBe(true);
  });
});

describe("resteDu et echeanceDe", () => {
  it("déduit le reste dû des règlements, sans négatif", () => {
    expect(resteDu(17_700, 10_000)).toBe(7_700);
    expect(resteDu(17_700, 20_000)).toBe(0);
  });

  it("ajoute le délai du client, y compris d'un mois sur l'autre", () => {
    expect(echeanceDe("2026-10-04", 30)).toBe("2026-11-03");
    expect(echeanceDe("2026-12-15", 30)).toBe("2027-01-14");
    expect(echeanceDe("2026-10-04", 0)).toBe("2026-10-04");
  });
});
