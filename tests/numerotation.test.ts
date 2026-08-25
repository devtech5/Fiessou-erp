import { describe, expect, it } from "vitest";

import { buildDocumentNumber, newId } from "@/lib/ids";

/**
 * Numérotation et identifiants.
 *
 * Le format vient du terrain : un ticket SOCOCE de Yopougon porte
 * `05-00066854/G` — préfixe, compteur sur huit chiffres, suffixe. D'où trois
 * réglages plutôt qu'un format figé.
 */

describe("buildDocumentNumber", () => {
  it("reproduit le format d'un ticket du terrain", () => {
    expect(
      buildDocumentNumber({ prefix: "05-", value: 66854, padding: 8, suffix: "/G" }),
    ).toBe("05-00066854/G");
  });

  it("complète à six chiffres par défaut", () => {
    expect(buildDocumentNumber({ value: 1 })).toBe("000001");
  });

  it("ne tronque pas un numéro plus long que le remplissage", () => {
    // Mieux vaut un numéro trop long qu'un numéro tronqué : deux pièces
    // différentes ne doivent jamais porter le même identifiant.
    expect(buildDocumentNumber({ value: 1_234_567, padding: 5 })).toBe("1234567");
  });

  it("garde l'ordre lexicographique dans une même suite", () => {
    const suite = [1, 2, 10, 99, 100].map((value) =>
      buildDocumentNumber({ prefix: "REC-2026-", value, padding: 5 }),
    );
    expect([...suite].sort()).toEqual(suite);
  });
});

describe("newId", () => {
  it("produit un UUID de version 7", () => {
    const id = newId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("croît avec le temps, ce qui garde l'index compact", () => {
    // C'est la raison d'être de la v7 : sur un journal de ventes qui grossit,
    // des identifiants voisins s'écrivent dans les mêmes pages d'index.
    const ids = Array.from({ length: 50 }, newId);
    expect([...ids].sort()).toEqual(ids);
  });

  it("ne se répète pas", () => {
    const ids = Array.from({ length: 1000 }, newId);
    expect(new Set(ids).size).toBe(1000);
  });
});
