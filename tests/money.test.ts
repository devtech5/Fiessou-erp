import { describe, expect, it } from "vitest";

import {
  allocate,
  allocateByWeights,
  divideMoney,
  exponentOf,
  percentOf,
  rateOf,
} from "@/lib/money";

/**
 * L'argent est un entier.
 *
 * Ces tests ne vérifient pas que le code fait ce qu'il dit : ils vérifient
 * qu'une ventilation ne perd ni ne crée de franc. C'est la seule propriété qui
 * compte — un écart d'un franc par ligne passe inaperçu sur un ticket et rend
 * une déclaration de TVA infalsifiable au contrôle.
 */

describe("allocate", () => {
  it("répartit sans perdre ni créer de franc", () => {
    for (const [montant, parts] of [
      [100, 3],
      [1, 3],
      [2900, 7],
      [1_000_000, 13],
      [0, 5],
    ] as const) {
      const portions = allocate(montant, parts);
      expect(portions).toHaveLength(parts);
      expect(portions.reduce((s, p) => s + p, 0)).toBe(montant);
    }
  });

  it("ne rend que des entiers", () => {
    for (const portion of allocate(100, 3)) {
      expect(Number.isInteger(portion)).toBe(true);
    }
  });

  it("place le reste sur les premières parts, pas sur la dernière", () => {
    // Le reste doit tomber sur les premiers : découvrir en fin de liste qu'une
    // part vaut un franc de plus donne l'impression d'une erreur de calcul.
    expect(allocate(100, 3)).toEqual([34, 33, 33]);
  });

  it("rend une liste vide pour zéro part", () => {
    expect(allocate(100, 0)).toEqual([]);
  });
});

describe("allocateByWeights", () => {
  it("répartit selon les poids sans perdre de franc", () => {
    const parts = allocateByWeights(1000, [60, 20, 12, 8]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(1000);
    expect(parts[0]).toBeGreaterThan(parts[1]);
  });

  it("retombe juste même quand la division ne tombe pas juste", () => {
    for (const montant of [1, 7, 101, 99_999]) {
      const parts = allocateByWeights(montant, [1, 1, 1]);
      expect(parts.reduce((s, p) => s + p, 0)).toBe(montant);
    }
  });

  it("rend des parts nulles quand tous les poids sont nuls", () => {
    expect(allocateByWeights(500, [0, 0])).toEqual([0, 0]);
  });
});

describe("divideMoney", () => {
  it("arrondit au franc et refuse la division par zéro", () => {
    expect(divideMoney(100, 3)).toBe(33);
    expect(divideMoney(0, 0)).toBe(0);
    expect(divideMoney(100, 0)).toBe(0);
  });
});

describe("rateOf", () => {
  it("applique un taux en points de base sans passer par un flottant", () => {
    // 85 × 0,7 vaut 59,499… en virgule flottante, donc 59 après arrondi.
    // Le passage par les points de base rend le 60 attendu.
    expect(rateOf(85, 7000)).toBe(60);
    expect(rateOf(2900, 1800)).toBe(522);
    expect(rateOf(1000, 0)).toBe(0);
  });
});

describe("percentOf", () => {
  it("rend un entier", () => {
    expect(percentOf(2900, 18)).toBe(522);
    expect(Number.isInteger(percentOf(333, 33))).toBe(true);
  });
});

describe("exponentOf", () => {
  it("donne zéro décimale au franc CFA", () => {
    expect(exponentOf("XOF")).toBe(0);
    expect(exponentOf("xof")).toBe(0);
    expect(exponentOf("XAF")).toBe(0);
  });

  it("retombe sur deux décimales pour une devise inconnue", () => {
    expect(exponentOf("ZZZ")).toBe(2);
  });
});
