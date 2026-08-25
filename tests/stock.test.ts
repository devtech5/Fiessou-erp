import { describe, expect, it } from "vitest";

import { formaterQuantite, versQuantite } from "@/lib/quantite";
import {
  joursRestants,
  quantiteSuggeree,
  type AlerteStock,
} from "@/modules/stock/requetes";

/**
 * Réapprovisionnement.
 *
 * Ces deux fonctions décident ce que le gérant commande le matin. Une erreur y
 * coûte soit une rupture — donc une vente perdue au profit de la boutique d'à
 * côté — soit un sur-stock immobilisé, ce qui est pire encore pour de la
 * trésorerie déjà tendue.
 */

function alerte(valeurs: Partial<AlerteStock> = {}): AlerteStock {
  return {
    articleId: "a1",
    designation: "Riz parfumé 5 kg",
    reference: "RIZ-PAR-5K",
    unite: "piece",
    quantite: versQuantite(20),
    seuil: versQuantite(10),
    prixAchat: 3150,
    ventes30j: versQuantite(300),
    fournisseurId: null,
    fournisseurNom: "Nestlé CI",
    delaiJours: 3,
    ...valeurs,
  };
}

describe("joursRestants", () => {
  it("compte les jours de vente au rythme constaté", () => {
    // 300 unités en 30 jours, soit 10 par jour ; il en reste 20.
    expect(joursRestants(alerte())).toBe(2);
  });

  it("rend l'infini quand l'article ne tourne pas", () => {
    // Sans rotation il n'y a pas d'échéance. Répondre « 0 jour » ferait
    // remonter en tête une commande dont personne n'a besoin, devant des
    // ruptures qui, elles, coûtent une vente.
    expect(joursRestants(alerte({ ventes30j: 0 }))).toBe(Infinity);
  });

  it("rend zéro sur une rupture", () => {
    expect(joursRestants(alerte({ quantite: 0 }))).toBe(0);
  });

  it("arrondit vers le bas", () => {
    // 25 unités à 10 par jour : deux jours pleins, pas trois.
    expect(joursRestants(alerte({ quantite: versQuantite(25) }))).toBe(2);
  });
});

describe("quantiteSuggeree", () => {
  it("couvre le délai fournisseur plus un mois de réserve", () => {
    // 10 par jour × (3 + 30) = 330, moins les 20 en rayon = 310.
    expect(quantiteSuggeree(alerte())).toBe(versQuantite(310));
  });

  it("ne descend jamais sous le seuil de l'article", () => {
    const dormant = alerte({ ventes30j: 0, quantite: 0, seuil: versQuantite(10) });
    expect(quantiteSuggeree(dormant)).toBe(versQuantite(10));
  });

  it("commande davantage quand le fournisseur est lent", () => {
    const rapide = quantiteSuggeree(alerte({ delaiJours: 1 }));
    const lent = quantiteSuggeree(alerte({ delaiJours: 10 }));
    expect(lent).toBeGreaterThan(rapide);
  });

  it("rend une quantité entière d'unités, jamais un demi-sac", () => {
    // 190 en 30 jours ne tombe pas rond : le résultat doit tout de même
    // s'arrondir à l'unité vendable supérieure.
    const suggeree = quantiteSuggeree(
      alerte({ ventes30j: versQuantite(190), quantite: versQuantite(12) }),
    );
    expect(suggeree % 1000).toBe(0);
    expect(formaterQuantite(suggeree, "piece")).toMatch(/^\d[\d\s ]* u$/);
  });

  it("tient compte de ce qui reste en rayon", () => {
    const vide = quantiteSuggeree(alerte({ quantite: 0 }));
    const fourni = quantiteSuggeree(alerte({ quantite: versQuantite(100) }));
    expect(vide).toBeGreaterThan(fourni);
  });
});
