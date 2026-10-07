import { describe, expect, it } from "vitest";

import { formaterValeur, lirePeriode, periodesRapides, totaux, versCsv, type ResultatRapport } from "@/lib/rapports/types";

const exemple: ResultatRapport = {
  colonnes: [
    { cle: "client", libelle: "Client", type: "texte" },
    { cle: "factures", libelle: "Factures", type: "entier", total: true },
    { cle: "quantite", libelle: "Quantité", type: "quantite", total: false },
    { cle: "ttc", libelle: "Total TTC", type: "montant" },
    { cle: "taux", libelle: "Marge", type: "taux_bp" },
  ],
  lignes: [
    { client: "Sotra; Abidjan", factures: 2, quantite: 1_340, ttc: 1_250_000, taux: 1_250 },
    { client: 'Le "Maquis"', factures: 1, quantite: 500, ttc: 2_900, taux: null },
  ],
};

describe("totaux", () => {
  it("additionne les montants et les colonnes marquées, jamais un taux", () => {
    expect(totaux(exemple)).toEqual({ factures: 3, ttc: 1_252_900 });
  });
});

describe("format", () => {
  it("lit chaque type comme on l'attend à l'écran", () => {
    // Intl sépare les milliers par une espace fine insécable.
    expect(formaterValeur(1_250_000, "montant").replace(/\s/g, " ")).toBe("1 250 000");
    expect(formaterValeur(1_340, "quantite")).toBe("1,34");
    expect(formaterValeur(1_250, "taux_bp")).toBe("12,5 %");
    expect(formaterValeur("2026-10-06", "date")).toBe("06/10/2026");
    expect(formaterValeur(null, "montant")).toBe("");
  });
});

describe("export CSV", () => {
  const csv = versCsv(exemple);
  const lignes = csv.replace("﻿", "").trim().split("\r\n");

  it("commence par le BOM et sépare au point-virgule, à la française", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lignes[0]).toBe("Client;Factures;Quantité;Total TTC;Marge");
  });

  it("garde les nombres sans séparateur de milliers, avec la virgule décimale", () => {
    expect(lignes[1]).toBe('"Sotra; Abidjan";2;1,34;1250000;12,5');
  });

  it("protège les guillemets et laisse vide une valeur absente", () => {
    expect(lignes[2]).toBe('"Le ""Maquis""";1;0,5;2900;');
  });

  it("ajoute la ligne de totaux", () => {
    expect(lignes[3]).toBe("Total;3;;1252900;");
  });
});

describe("périodes", () => {
  it("propose les périodes courantes, mois dernier compris à travers l'année", () => {
    const p = Object.fromEntries(periodesRapides("2026-01-15").map((x) => [x.cle, x]));
    expect(p["mois"]).toMatchObject({ du: "2026-01-01", au: "2026-01-15" });
    expect(p["mois-1"]).toMatchObject({ du: "2025-12-01", au: "2025-12-31" });
    expect(p["7j"]).toMatchObject({ du: "2026-01-09", au: "2026-01-15" });
    expect(p["annee-1"]).toMatchObject({ du: "2025-01-01", au: "2025-12-31" });
    expect(periodesRapides("2026-02-10").find((x) => x.cle === "mois-1")?.au).toBe("2026-01-31");
    expect(periodesRapides("2026-08-20").find((x) => x.cle === "trimestre")?.du).toBe("2026-07-01");
  });

  it("lit la période de l'adresse, ce mois par défaut, jamais à l'envers", () => {
    expect(lirePeriode({}, "2026-10-06")).toEqual({ du: "2026-10-01", au: "2026-10-06" });
    expect(lirePeriode({ du: "2026-09-01", au: "2026-09-30" }, "2026-10-06")).toEqual({ du: "2026-09-01", au: "2026-09-30" });
    expect(lirePeriode({ du: "2026-12-01", au: "2026-09-30" }, "2026-10-06")).toEqual({ du: "2026-09-01", au: "2026-09-30" });
    expect(lirePeriode({ du: "n'importe", au: "quoi" }, "2026-10-06")).toEqual({ du: "2026-10-01", au: "2026-10-06" });
  });
});
