import { describe, expect, it } from "vitest";

import { estEquilibree, totalDebit } from "@/lib/comptabilite/ecritures";
import { contrepasser } from "@/lib/comptabilite/ecritures";
import {
  capacite,
  comparerSieges,
  departVendable,
  ecritureBillet,
  formaterDuree,
  siegeValide,
  siegesDuVehicule,
  tauxRemplissage,
  transitionPermise,
} from "@/modules/billetterie/calcul";

describe("plan de places", () => {
  it("compte quatre sièges par rangée", () => {
    expect(capacite(15)).toBe(60);
    expect(siegesDuVehicule(2)).toEqual(["1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D"]);
  });

  it("refuse un siège hors du véhicule", () => {
    expect(siegeValide("15D", 15)).toBe(true);
    expect(siegeValide("16A", 15)).toBe(false);
    expect(siegeValide("0A", 15)).toBe(false);
    expect(siegeValide("3E", 15)).toBe(false);
    expect(siegeValide("3a", 15)).toBe(false);
    expect(siegeValide("A3", 15)).toBe(false);
  });

  it("range 2A avant 10A", () => {
    expect(["10A", "2B", "2A", "1D"].sort(comparerSieges)).toEqual(["1D", "2A", "2B", "10A"]);
  });

  it("arrondit le remplissage", () => {
    expect(tauxRemplissage(40, 15)).toBe(67);
    expect(tauxRemplissage(0, 8)).toBe(0);
    expect(tauxRemplissage(32, 8)).toBe(100);
  });
});

describe("cycle d'un départ", () => {
  it("vend jusqu'au départ, embarquement compris", () => {
    expect(departVendable("ouvert")).toBe(true);
    expect(departVendable("embarquement")).toBe(true);
    expect(departVendable("parti")).toBe(false);
    expect(departVendable("annule")).toBe(false);
  });

  it("n'avance que dans un sens", () => {
    expect(transitionPermise("ouvert", "embarquement")).toBe(true);
    expect(transitionPermise("embarquement", "parti")).toBe(true);
    expect(transitionPermise("ouvert", "parti")).toBe(false);
    expect(transitionPermise("parti", "annule")).toBe(false);
    expect(transitionPermise("annule", "ouvert")).toBe(false);
  });

  it("formate une durée", () => {
    expect(formaterDuree(300)).toBe("5 h");
    expect(formaterDuree(330)).toBe("5 h 30");
    expect(formaterDuree(245)).toBe("4 h 05");
  });
});

describe("écriture d'un billet", () => {
  const billet = {
    numero: "BIL-2026-000001",
    date: "2026-10-04",
    passager: "Bamba Awa",
    trajet: "Abidjan → Bouaké",
    montant: 6_000,
    tauxTvaBp: 1800,
    moyen: "especes" as const,
  };

  it("encaisse en caisse et ventile HT et TVA sans perdre un franc", () => {
    const e = ecritureBillet(billet);
    expect(estEquilibree(e)).toBe(true);
    expect(e.journal).toBe("CA");
    expect(e.lignes.find((l) => l.compte === "571")?.debit).toBe(6_000);
    const ht = e.lignes.find((l) => l.compte === "706")!.credit;
    const tva = e.lignes.find((l) => l.compte === "4431")!.credit;
    expect(ht + tva).toBe(6_000);
    expect(ht).toBe(5_085);
  });

  it("solde le mobile money en 5711 et la banque au journal BQ", () => {
    expect(ecritureBillet({ ...billet, moyen: "mobile_money" }).lignes[0].compte).toBe("5711");
    const banque = ecritureBillet({ ...billet, moyen: "banque" });
    expect(banque.journal).toBe("BQ");
    expect(banque.lignes[0].compte).toBe("521");
  });

  it("sans TVA, tout va au produit", () => {
    const e = ecritureBillet({ ...billet, tauxTvaBp: 0 });
    expect(e.lignes.map((l) => l.compte)).toEqual(["571", "706"]);
  });

  it("l'annulation contrepasse exactement la vente", () => {
    const vente = ecritureBillet(billet);
    const annulation = contrepasser(vente, `${billet.numero}-A`, "Annulation");
    expect(estEquilibree(annulation)).toBe(true);
    expect(totalDebit(annulation)).toBe(totalDebit(vente));
    expect(annulation.lignes.find((l) => l.compte === "571")?.credit).toBe(6_000);
  });
});
