import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import {
  ecritureRepriseClient,
  ecritureRepriseFournisseur,
  ecritureRepriseTresorerie,
  lireArticles,
  lireCsv,
  lireDate,
  lireMontant,
  lireQuantite,
  lireTiers,
  MODELES,
} from "@/modules/reprise/calcul";

describe("lecture des fichiers", () => {
  it("lit un CSV Excel français : point-virgule, BOM, guillemets, CRLF", () => {
    const { entetes, lignes } = lireCsv('﻿Référence;Désignation;"Prix vente"\r\nA1;"Ciment; sac 50 kg";5 200\r\n\r\n');
    expect(entetes).toEqual(["reference", "designation", "prix_vente"]);
    expect(lignes).toEqual([{ numero: 2, valeurs: { reference: "A1", designation: "Ciment; sac 50 kg", prix_vente: "5 200" } }]);
  });

  it("détecte la virgule comme séparateur", () => {
    expect(lireCsv("nom,solde\nAwa,1000\n").lignes[0].valeurs).toEqual({ nom: "Awa", solde: "1000" });
  });

  it("lit montants, quantités et dates sans flottant", () => {
    expect(lireMontant("1 250 000")).toBe(1_250_000);
    expect(lireMontant("1.250.000")).toBe(1_250_000);
    expect(lireMontant("12500 F")).toBe(12_500);
    expect(lireMontant("12,50")).toBeNull();
    expect(lireQuantite("2,5")).toBe(2_500);
    expect(lireQuantite("0.001")).toBe(1);
    expect(lireQuantite("1,2345")).toBeNull();
    expect(lireDate("31/12/2025")).toBe("2025-12-31");
    expect(lireDate("31/02/2025")).toBeNull();
  });

  it("lit les modèles fournis sans anomalie", () => {
    expect(lireArticles(MODELES.articles)).toMatchObject({ anomalies: [] });
    const t = lireTiers(MODELES.tiers);
    expect(t.anomalies).toEqual([]);
    expect(t.tiers.map((x) => [x.estClient, x.estFournisseur, x.solde])).toEqual([
      [true, false, 350_000],
      [false, true, 1_200_000],
    ]);
  });

  it("signale chaque ligne fautive avec son numéro", () => {
    const { anomalies } = lireArticles("designation;prix_vente;unite\n;100;piece\nClou;12,5;piece\nVis;10;caisse\n");
    expect(anomalies.map((a) => a.ligne)).toEqual([2, 3, 4]);
  });
});

describe("écritures d'ouverture", () => {
  it("sont équilibrées et passent par le compte d'attente", () => {
    const c = ecritureRepriseClient({ piece: "FAC-2026-00001", date: "2026-09-30", client: "SOCOCE", auxiliaire: "411001", montant: 350_000 });
    expect(estEquilibree(c)).toBe(true);
    expect(c.lignes[0]).toMatchObject({ compte: "411", auxiliaire: "411001", debit: 350_000 });
    const f = ecritureRepriseFournisseur({ piece: "FF-2026-00001", date: "2026-09-30", fournisseur: "Cimaf", auxiliaire: "401001", montant: 1_200_000 });
    expect(estEquilibree(f)).toBe(true);
    const decouvert = ecritureRepriseTresorerie({ piece: "OUV-5211", date: "2026-09-30", compte: "5211", libelle: "Banque", solde: -80_000 });
    expect(decouvert?.lignes.find((l) => l.compte === "5211")?.credit).toBe(80_000);
    expect(ecritureRepriseTresorerie({ piece: "OUV-571", date: "2026-09-30", compte: "571", libelle: "Caisse", solde: 0 })).toBeNull();
  });
});
