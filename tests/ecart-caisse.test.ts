import { describe, expect, it } from "vitest";

import {
  ecritureEcartCaisse,
  estEquilibree,
  totalDebit,
} from "@/lib/comptabilite/ecritures";

/**
 * Écart de caisse.
 *
 * C'est le calcul qui décide si un manque est constaté ou passe inaperçu. Une
 * erreur de signe y transformerait un vol en excédent — et le rendrait
 * invisible exactement là où on le cherche.
 */

function cloture(ecarts: Parameters<typeof ecritureEcartCaisse>[0]["ecarts"]) {
  return ecritureEcartCaisse({
    numero: "CLO-2026-00001",
    date: "2026-08-25",
    caissier: "Aya D.",
    ecarts,
  });
}

describe("ecritureEcartCaisse", () => {
  it("ne produit rien quand la caisse tombe juste", () => {
    // Le cas normal ne mérite aucune écriture : une ligne à zéro dans un
    // journal est du bruit qui masque les vraies.
    expect(cloture([{ moyen: "especes", ecart: 0 }])).toBeNull();
    expect(cloture([])).toBeNull();
  });

  it("passe un manque en charge, jamais en produit", () => {
    const ecriture = cloture([{ moyen: "especes", ecart: -2500 }]);

    expect(ecriture).not.toBeNull();
    const charge = ecriture?.lignes.find((ligne) => ligne.compte === "658");
    const caisse = ecriture?.lignes.find((ligne) => ligne.compte === "571");

    expect(charge?.debit).toBe(2500);
    expect(caisse?.credit).toBe(2500);
    expect(estEquilibree(ecriture!)).toBe(true);
  });

  it("passe un excédent en produit", () => {
    const ecriture = cloture([{ moyen: "especes", ecart: 1500 }]);

    const produit = ecriture?.lignes.find((ligne) => ligne.compte === "758");
    const caisse = ecriture?.lignes.find((ligne) => ligne.compte === "571");

    expect(produit?.credit).toBe(1500);
    expect(caisse?.debit).toBe(1500);
    expect(estEquilibree(ecriture!)).toBe(true);
  });

  it("impute chaque écart sur le compte de son moyen", () => {
    // Un manque d'espèces sort du tiroir, un écart de mobile money du compte
    // de l'opérateur. Les confondre ferait tomber juste une caisse qui ne
    // l'est pas.
    const ecriture = cloture([
      { moyen: "especes", ecart: -1000 },
      { moyen: "mobile_money", ecart: 400 },
    ]);

    const comptes = ecriture?.lignes.map((ligne) => ligne.compte) ?? [];
    expect(comptes).toContain("571");
    expect(comptes).toContain("5711");
    expect(estEquilibree(ecriture!)).toBe(true);
  });

  it("reste équilibré quand manque et excédent se croisent", () => {
    const ecriture = cloture([
      { moyen: "especes", ecart: -3000 },
      { moyen: "carte", ecart: 3000 },
    ]);

    expect(estEquilibree(ecriture!)).toBe(true);
    // Les deux mouvements coexistent : ils ne se compensent pas en une seule
    // ligne nulle, sinon l'écart d'espèces disparaîtrait du journal.
    expect(totalDebit(ecriture!)).toBe(6000);
  });

  it("écarte les moyens sans écart", () => {
    const ecriture = cloture([
      { moyen: "especes", ecart: -500 },
      { moyen: "carte", ecart: 0 },
      { moyen: "banque", ecart: 0 },
    ]);

    expect(ecriture?.lignes).toHaveLength(2);
  });

  it("passe par le journal des opérations diverses", () => {
    expect(cloture([{ moyen: "especes", ecart: -100 }])?.journal).toBe("OD");
  });
});
