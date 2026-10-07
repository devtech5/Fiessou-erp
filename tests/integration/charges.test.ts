import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { depenses } from "@/modules/projets/schema";
import {
  creerChargeDans,
  definirBudgetDans,
  ignorerEcheanceDans,
  preparerEcheanceDans,
} from "@/modules/tresorerie/creation-charges";
import { budgetsParFamille, fluxChargesRecurrentes, listerChargesRecurrentes } from "@/modules/tresorerie/requetes-charges";

import { ouvrirBaseDeTest, semerEntreprise } from "./base";

let db: typeof Db;
let fermer: () => Promise<void>;
let org: string;
let user: string;

beforeAll(async () => {
  ({ db, fermer } = await ouvrirBaseDeTest());
  ({ organizationId: org, userId: user } = await semerEntreprise(db));
});
afterAll(async () => fermer());

const loyer = {
  libelle: "Loyer boutique Yopougon",
  categorie: "location",
  montant: 150_000,
  periodicite: "mensuelle" as const,
  premiereEcheance: "2026-10-05",
  fournisseurLibelle: "M. Kouassi",
};

describe("charges récurrentes en base", () => {
  it("prépare la dépense d'une échéance, une seule fois", async () => {
    const { id } = await db.transaction((tx) => creerChargeDans(tx, org, loyer, user, "2026-10-06"));

    const { numero } = await db.transaction((tx) => preparerEcheanceDans(tx, org, id, "2026-10", user));
    const [d] = await db.select().from(depenses).where(and(eq(depenses.organizationId, org), eq(depenses.numero, numero)));
    // Une demande ordinaire : elle attend l'approbation d'un autre.
    expect(d).toMatchObject({ statut: "demandee", montant: 150_000, categorie: "location", objet: "Loyer boutique Yopougon — octobre 2026" });

    await expect(db.transaction((tx) => preparerEcheanceDans(tx, org, id, "2026-10", user))).rejects.toThrow(/déjà traitée/);
    // Avant la première échéance, il n'y a rien à préparer.
    await expect(db.transaction((tx) => preparerEcheanceDans(tx, org, id, "2026-09", user))).rejects.toThrow(/pas d'échéance/);

    const [vue] = await listerChargesRecurrentes(org, "2026-10-06");
    expect(vue.prochaine).toEqual({ periode: "2026-11", date: "2026-11-05" });
    expect(vue.derniere).toMatchObject({ periode: "2026-10", depense: numero, statut: "demandee" });
  });

  it("une échéance écartée sort du plan, la préparée y est déjà par sa dépense", async () => {
    const { id } = await db.transaction((tx) =>
      creerChargeDans(tx, org, { ...loyer, libelle: "Internet", categorie: "telecom", montant: 25_000, premiereEcheance: "2026-10-20" }, user, "2026-10-06"),
    );
    await db.transaction((tx) => ignorerEcheanceDans(tx, org, id, "2026-10", user));
    await expect(db.transaction((tx) => preparerEcheanceDans(tx, org, id, "2026-10", user))).rejects.toThrow(/déjà traitée/);

    const flux = await fluxChargesRecurrentes(org, "2026-12-31");
    const internet = flux.filter((f) => f.libelle.startsWith("Internet")).map((f) => f.date);
    expect(internet).toEqual(["2026-11-20", "2026-12-20"]);
    // Le loyer d'octobre est préparé : seule sa dépense le porte désormais.
    expect(flux.some((f) => f.libelle === "Loyer boutique Yopougon — octobre 2026")).toBe(false);
    expect(flux.every((f) => f.montant < 0 && f.origine === "recurrente")).toBe(true);
  });

  it("refuse une première échéance trop ancienne", async () => {
    await expect(db.transaction((tx) => creerChargeDans(tx, org, { ...loyer, premiereEcheance: "2025-01-05" }, user, "2026-10-06"))).rejects.toThrow(
      /à venir/,
    );
  });

  it("un budget se fixe, se modifie et se retire", async () => {
    await db.transaction((tx) => definirBudgetDans(tx, org, "energie", 80_000, user));
    await db.transaction((tx) => definirBudgetDans(tx, org, "energie", 90_000, user));
    expect((await budgetsParFamille(org)).get("energie")).toBe(90_000);
    await db.transaction((tx) => definirBudgetDans(tx, org, "energie", 0, user));
    expect((await budgetsParFamille(org)).has("energie")).toBe(false);
    await db.transaction((tx) => definirBudgetDans(tx, org, "energie", 70_000, user));
    expect((await budgetsParFamille(org)).get("energie")).toBe(70_000);
    await expect(db.transaction((tx) => definirBudgetDans(tx, org, "inconnue", 1, user))).rejects.toThrow(/inconnue/);
  });
});
