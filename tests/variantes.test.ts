import { describe, expect, it } from "vitest";

import {
  cleCombinaison,
  codeValeur,
  combinaisons,
  designationVariante,
  fusionnerAxes,
  nombreDeVariantes,
  referenceVariante,
  refusAxes,
} from "@/modules/catalogue/variantes";

const axes = [
  { nom: "Pointure", valeurs: ["40", "41", "42"] },
  { nom: "Couleur", valeurs: ["Noir", "Marron"] },
];

describe("variantes d'un modèle", () => {
  it("donne des codes courts, sans accent ni espace", () => {
    expect(codeValeur("42")).toBe("42");
    expect(codeValeur("Noir")).toBe("NOIR");
    expect(codeValeur("Bleu marine")).toBe("BLEUMA");
    expect(codeValeur("Écru")).toBe("ECRU");
    expect(codeValeur("38 1/2")).toBe("3812");
  });

  it("produit toutes les combinaisons, avec références et désignations lisibles", () => {
    const c = combinaisons(axes);
    expect(c).toHaveLength(6);
    expect(nombreDeVariantes(axes)).toBe(6);
    expect(c[0]).toEqual({ Pointure: "40", Couleur: "Noir" });
    expect(referenceVariante("DERBY", c[5], axes)).toBe("DERBY-42-MARRON");
    expect(designationVariante("Derby cuir", c[5], axes)).toBe("Derby cuir — 42 · Marron");
    expect(cleCombinaison({ Couleur: "Noir", Pointure: "40" }, axes)).toBe(cleCombinaison(c[0], axes));
  });

  it("refuse les axes ambigus ou trop nombreux", () => {
    expect(refusAxes(axes)).toBeNull();
    expect(refusAxes([])).toMatch(/au moins un axe/);
    expect(refusAxes([{ nom: "Taille", valeurs: [] }])).toMatch(/aucune valeur/);
    expect(refusAxes([{ nom: "Taille", valeurs: ["M", "m"] }])).toMatch(/deux fois/);
    expect(refusAxes([{ nom: "Couleur", valeurs: ["Bleu clair", "Bleu clé"] }])).toMatch(/même code/);
    expect(refusAxes([...axes, { nom: "pointure", valeurs: ["1"] }])).toMatch(/deux fois/);
    const grand = Array.from({ length: 40 }, (_, i) => String(i + 1));
    expect(refusAxes([{ nom: "A", valeurs: grand }, { nom: "B", valeurs: grand }])).toMatch(/Scindez/);
  });

  it("ajoute des valeurs sans toucher aux existantes ni créer d'axe", () => {
    const f = fusionnerAxes(axes, [{ nom: "couleur", valeurs: ["Bordeaux", "noir"] }, { nom: "Matière", valeurs: ["Daim"] }]);
    expect(f).toEqual([
      { nom: "Pointure", valeurs: ["40", "41", "42"] },
      { nom: "Couleur", valeurs: ["Noir", "Marron", "Bordeaux"] },
    ]);
  });
});
