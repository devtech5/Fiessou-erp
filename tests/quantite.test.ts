import { describe, expect, it } from "vitest";

import {
  ajusterAuPas,
  depuisQuantite,
  ECHELLE_QUANTITE,
  formaterQuantite,
  montantLigne,
  prixUnitaireDeduit,
  quantiteValide,
  UNITES,
  versQuantite,
} from "@/lib/quantite";

/**
 * Les quantités sont des entiers en millièmes d'unité.
 *
 * L'enjeu est le même que pour l'argent : une dérive invisible sur une ligne
 * produit un inventaire faux et inexplicable après quelques milliers de
 * mouvements.
 */

describe("versQuantite / depuisQuantite", () => {
  it("convertit dans les deux sens", () => {
    expect(versQuantite(1.34)).toBe(1340);
    expect(versQuantite(2)).toBe(2000);
    expect(versQuantite(0.5)).toBe(500);
    expect(depuisQuantite(1340)).toBe(1.34);
  });

  it("rend toujours un entier, même sur une saisie à décimales longues", () => {
    // 0,1 + 0,2 ne fait pas 0,3 en virgule flottante : la conversion doit
    // absorber le bruit plutôt que de le propager en base.
    expect(Number.isInteger(versQuantite(0.1 + 0.2))).toBe(true);
    expect(versQuantite(0.1 + 0.2)).toBe(300);
  });
});

describe("montantLigne", () => {
  it("multiplie un prix par une quantité et rend un entier de francs", () => {
    // 1,34 kg de thiof à 4 500 F le kilo.
    expect(montantLigne(4500, 1340)).toBe(6030);
    // Deux pièces à 2 900 F.
    expect(montantLigne(2900, 2000)).toBe(5800);
  });

  it("arrondit le montant, jamais la quantité", () => {
    // 0,333 kg à 1 000 F donne 333 F : le poids reste ce que le client emporte.
    expect(montantLigne(1000, 333)).toBe(333);
    expect(Number.isInteger(montantLigne(333, 333))).toBe(true);
  });

  it("reste exact sur de gros volumes", () => {
    expect(montantLigne(1_000_000, 1_000_000)).toBe(1_000_000_000);
  });
});

describe("prixUnitaireDeduit", () => {
  it("retrouve le prix unitaire depuis un total et un poids", () => {
    expect(prixUnitaireDeduit(6030, 1340)).toBe(4500);
    expect(prixUnitaireDeduit(0, 0)).toBe(0);
  });

  it("fait l'aller-retour avec montantLigne", () => {
    const prix = 4500;
    const quantite = 1340;
    expect(prixUnitaireDeduit(montantLigne(prix, quantite), quantite)).toBe(prix);
  });
});

describe("quantiteValide", () => {
  it("refuse une fraction sur une unité non fractionnable", () => {
    expect(quantiteValide(400, "piece")).toBe(false);
    expect(quantiteValide(2000, "piece")).toBe(true);
  });

  it("accepte une fraction au poids", () => {
    expect(quantiteValide(1340, "kg")).toBe(true);
  });

  it("refuse zéro et le négatif dans tous les cas", () => {
    for (const unite of Object.keys(UNITES) as (keyof typeof UNITES)[]) {
      expect(quantiteValide(0, unite)).toBe(false);
      expect(quantiteValide(-1000, unite)).toBe(false);
    }
  });
});

describe("ajusterAuPas", () => {
  it("cale une pesée sur le pas de son unité", () => {
    // La balance donne le gramme, le pas du kilo est de 10 g.
    expect(ajusterAuPas(1337, "kg")).toBe(1340);
    expect(ajusterAuPas(1334, "kg")).toBe(1330);
  });

  it("ne descend jamais sous un pas", () => {
    expect(ajusterAuPas(0, "piece")).toBe(1000);
    expect(ajusterAuPas(1, "kg")).toBe(10);
  });

  it("rend un multiple exact du pas", () => {
    for (const unite of Object.keys(UNITES) as (keyof typeof UNITES)[]) {
      expect(ajusterAuPas(4321, unite) % UNITES[unite].pas).toBe(0);
    }
  });
});

describe("formaterQuantite", () => {
  it("masque les décimales d'une unité non fractionnable", () => {
    expect(formaterQuantite(2000, "piece")).toBe("2 u");
  });

  it("montre les décimales au poids", () => {
    expect(formaterQuantite(1340, "kg")).toBe("1,34 kg");
  });

  it("peut omettre l'unité", () => {
    expect(formaterQuantite(2000, "piece", false)).toBe("2");
  });
});

describe("échelle", () => {
  it("est de mille, et les unités s'y accordent", () => {
    expect(ECHELLE_QUANTITE).toBe(1000);
    for (const unite of Object.values(UNITES)) {
      expect(ECHELLE_QUANTITE % unite.pas).toBe(0);
    }
  });
});
