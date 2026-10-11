import { describe, expect, it } from "vitest";

import {
  cfaVersEuro,
  depuisTtc,
  euroVersCfa,
  evaluer,
  formater,
  lireSaisie,
  marge,
  remise,
  versTtc,
} from "@/lib/calculette";

const calcul = (expression: string) => formater(evaluer(expression)).texte.replace(/ /g, " ");
const f = (texte: string) => lireSaisie(texte)!;

describe("calculette", () => {
  it("compte juste là où la virgule flottante se trompe", () => {
    expect(calcul("0,1 + 0,2")).toBe("0,3");
    expect(calcul("1999 × 0,18")).toBe("359,82");
    expect(calcul("1.1 * 3")).toBe("3,3");
  });

  it("respecte les priorités, les parenthèses et le signe", () => {
    expect(calcul("2 + 3 × 4")).toBe("14");
    expect(calcul("(2 + 3) × 4")).toBe("20");
    expect(calcul("-5 + 2")).toBe("−3");
    expect(calcul("10 - -2")).toBe("12");
    // Parenthèse ouverte en fin de saisie : refermée, comme sur une calculette.
    expect(calcul("2 × (3 + 1")).toBe("8");
  });

  it("lit les milliers séparés par des espaces et sépare les résultats", () => {
    expect(calcul("1 250 000 ÷ 4")).toBe("312 500");
    expect(calcul("25 000 × 3")).toBe("75 000");
  });

  it("applique le pourcentage comme une calculette de comptoir", () => {
    expect(calcul("200 + 10 %")).toBe("220");
    expect(calcul("200 - 10%")).toBe("180");
    expect(calcul("200 × 10 %")).toBe("20");
    expect(calcul("10 %")).toBe("0,1");
  });

  it("arrondit l'affichage et le signale", () => {
    expect(formater(evaluer("1 ÷ 3"))).toEqual({ texte: "0,333333", exact: false });
    expect(formater(evaluer("2 ÷ 3")).texte).toBe("0,666667");
    expect(formater(evaluer("1 ÷ 4")).exact).toBe(true);
  });

  it("refuse ce qui n'a pas de sens, avec un message lisible", () => {
    expect(() => evaluer("5 ÷ 0")).toThrow(/Division par zéro/);
    expect(() => evaluer("5 +")).toThrow(/incomplète/);
    expect(() => evaluer("1,2,3")).toThrow(/illisible/);
    expect(() => evaluer("2 $ 3")).toThrow(/inattendu/);
    expect(() => evaluer("(2 + 3))")).toThrow(/parenthèse/i);
  });
});

describe("outils", () => {
  it("TVA : du hors taxes au TTC, et du TTC au hors taxes sans perdre un franc", () => {
    expect(versTtc(f("10 000"), f("18"))).toEqual({ ht: 10_000, tva: 1_800, ttc: 11_800 });
    expect(depuisTtc(f("11 800"), f("18"))).toEqual({ ht: 10_000, tva: 1_800, ttc: 11_800 });
    const r = depuisTtc(f("2 900"), f("18"));
    expect(r.ht + r.tva).toBe(2_900);
    expect(r).toEqual({ ht: 2_458, tva: 442, ttc: 2_900 });
  });

  it("remise et marge : le taux de marge sur l'achat, le taux de marque sur la vente", () => {
    expect(remise(f("15 000"), f("10"))).toEqual({ remise: 1_500, net: 13_500 });
    expect(marge(f("800"), f("1 000"))).toEqual({ marge: 200, tauxMarge: "25 %", tauxMarque: "20 %" });
    expect(marge(f("0"), f("1 000")).tauxMarge).toBeNull();
  });

  it("convertit à la parité fixe du franc CFA", () => {
    expect(euroVersCfa(f("100"))).toBe(65_596);
    expect(euroVersCfa(f("1"))).toBe(656);
    expect(cfaVersEuro(f("655 957")).replace(/ /g, " ")).toBe("1 000");
  });
});
