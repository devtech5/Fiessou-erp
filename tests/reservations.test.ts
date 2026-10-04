import { describe, expect, it } from "vitest";

import { estEquilibree, totalDebit } from "@/lib/comptabilite/ecritures";
import {
  accesAbonnement,
  ajouterJours,
  ecritureRemise,
  ecritureRestitution,
  joursEntre,
  occupationMax,
  prisLe,
  prixPeriode,
} from "@/modules/reservations/calcul";

const grille = { tarifJour: 15_000, tarifSemaine: 80_000, tarifMois: 280_000 };

describe("durée", () => {
  it("compte une période inclusive", () => {
    expect(joursEntre("2026-08-20", "2026-08-27")).toBe(8);
    expect(joursEntre("2026-08-20", "2026-08-20")).toBe(1);
  });

  it("traverse les mois et les années", () => {
    expect(ajouterJours("2026-12-30", 3)).toBe("2027-01-02");
    expect(joursEntre("2026-02-27", "2026-03-02")).toBe(4);
  });
});

describe("prixPeriode", () => {
  it("applique le tarif journalier sous la semaine", () => {
    expect(prixPeriode(grille, 3)).toEqual({ montant: 45_000, base: "jour" });
  });

  it("bascule au forfait et paie le reliquat au jour", () => {
    expect(prixPeriode(grille, 7)).toEqual({ montant: 80_000, base: "semaine" });
    expect(prixPeriode(grille, 10)).toEqual({ montant: 125_000, base: "semaine" });
    expect(prixPeriode(grille, 30)).toEqual({ montant: 280_000, base: "mois" });
    expect(prixPeriode(grille, 38)).toEqual({ montant: 375_000, base: "mois" });
  });

  it("n'arrondit jamais au forfait supérieur", () => {
    const cinqJours = prixPeriode(grille, 5);
    expect(cinqJours?.montant).toBe(75_000);
  });

  it("refuse une durée que la grille ne sert pas", () => {
    expect(prixPeriode({ tarifJour: null, tarifSemaine: null, tarifMois: 450_000 }, 3)?.montant).toBe(450_000);
    expect(prixPeriode({ tarifJour: null, tarifSemaine: null, tarifMois: null }, 3)).toBeNull();
    expect(prixPeriode(grille, 0)).toBeNull();
  });
});

describe("disponibilité", () => {
  const occupations = [
    { debut: "2026-10-01", fin: "2026-10-03", quantite: 1 },
    { debut: "2026-10-03", fin: "2026-10-05", quantite: 2 },
  ];

  it("additionne les exemplaires pris un jour donné", () => {
    expect(prisLe(occupations, "2026-10-02")).toBe(1);
    expect(prisLe(occupations, "2026-10-03")).toBe(3);
    expect(prisLe(occupations, "2026-10-06")).toBe(0);
  });

  it("retient le jour le plus chargé de la période", () => {
    expect(occupationMax(occupations, "2026-10-01", "2026-10-02")).toBe(1);
    expect(occupationMax(occupations, "2026-10-01", "2026-10-05")).toBe(3);
  });
});

describe("écritures", () => {
  it("encaisse la location et met la caution en dette", () => {
    const ecriture = ecritureRemise({
      numero: "LOC-2026-00001",
      date: "2026-10-04",
      client: "Client",
      montantTtc: 118_000,
      tauxTvaBp: 1800,
      caution: 150_000,
      moyen: "especes",
    });
    expect(estEquilibree(ecriture)).toBe(true);
    expect(totalDebit(ecriture)).toBe(268_000);
    expect(ecriture.lignes.find((l) => l.compte === "706")?.credit).toBe(100_000);
    expect(ecriture.lignes.find((l) => l.compte === "4431")?.credit).toBe(18_000);
    expect(ecriture.lignes.find((l) => l.compte === "165")?.credit).toBe(150_000);
  });

  it("rend la caution moins la retenue, qui seule devient recette", () => {
    const ecriture = ecritureRestitution({
      numero: "LOC-2026-00001",
      date: "2026-10-10",
      client: "Client",
      caution: 150_000,
      retenue: 45_000,
      moyen: "mobile_money",
    });
    expect(ecriture && estEquilibree(ecriture)).toBe(true);
    expect(ecriture?.lignes.find((l) => l.compte === "5711")?.credit).toBe(105_000);
    expect(ecriture?.lignes.find((l) => l.compte === "758")?.credit).toBe(45_000);
  });

  it("n'écrit rien sans caution, et refuse une retenue supérieure", () => {
    const base = { numero: "X", date: "2026-10-10", client: "C", moyen: "especes" as const };
    expect(ecritureRestitution({ ...base, caution: 0, retenue: 0 })).toBeNull();
    expect(() => ecritureRestitution({ ...base, caution: 100, retenue: 101 })).toThrow();
  });
});

describe("accès d'un adhérent", () => {
  const forfait = { debut: "2026-10-01", fin: "2026-10-31", seancesIncluses: null, seancesConsommees: 40 };
  const carnet = { debut: "2026-10-01", fin: "2026-12-31", seancesIncluses: 8, seancesConsommees: 7 };

  it("laisse entrer au forfait tant que la date tient, quel que soit le nombre de venues", () => {
    expect(accesAbonnement(forfait, "2026-10-15")).toEqual({ ok: true, restantes: null });
    expect(accesAbonnement(forfait, "2026-11-01").ok).toBe(false);
  });

  it("décompte la séance et refuse quand le carnet est vide", () => {
    expect(accesAbonnement(carnet, "2026-10-15")).toEqual({ ok: true, restantes: 0 });
    expect(accesAbonnement({ ...carnet, seancesConsommees: 8 }, "2026-10-15").ok).toBe(false);
  });
});
