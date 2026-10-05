import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { ajouterValeursDans, creerModeleDans, modeleDetail, modifierPrixVariantesDans } from "@/modules/catalogue/modeles";
import { creerArticleDans } from "@/modules/catalogue/creation";

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

describe("modèle à variantes", () => {
  it("génère un article par combinaison, puis complète sans doublon", async () => {
    const m = await db.transaction((tx) =>
      creerModeleDans(tx, org, { reference: "derby", designation: "Derby cuir", prixVente: 25_000, prixAchat: 14_000, axes: [{ nom: "Pointure", valeurs: ["40", "41", "42"] }, { nom: "Couleur", valeurs: ["Noir", "Marron"] }] }, user),
    );
    expect(m).toMatchObject({ reference: "DERBY", variantes: 6 });

    const d = await modeleDetail(org, m.id);
    expect(d!.variantes.map((v) => v.reference)).toContain("DERBY-42-MARRON");
    expect(d!.variantes.find((v) => v.reference === "DERBY-40-NOIR")).toMatchObject({ designation: "Derby cuir — 40 · Noir", prixVente: 25_000, attributs: { Pointure: "40", Couleur: "Noir" } });

    // Une pointure de plus : seules les deux nouvelles combinaisons naissent.
    const a = await db.transaction((tx) => ajouterValeursDans(tx, org, m.id, [{ nom: "Pointure", valeurs: ["43", "40"] }], user));
    expect(a.variantes).toBe(2);
    expect((await modeleDetail(org, m.id))!.variantes).toHaveLength(8);

    const v46 = d!.variantes.find((v) => v.reference === "DERBY-42-NOIR")!;
    await db.transaction((tx) => modifierPrixVariantesDans(tx, org, m.id, [{ articleId: v46.id, prixVente: 27_500 }], user));
    expect((await modeleDetail(org, m.id))!.variantes.find((v) => v.id === v46.id)?.prixVente).toBe(27_500);
  });

  it("refuse une référence de variante déjà prise par un autre article", async () => {
    await db.transaction((tx) => creerArticleDans(tx, org, { reference: "POLO-M", designation: "Polo isolé", prixVente: 5_000 }));
    await expect(
      db.transaction((tx) => creerModeleDans(tx, org, { reference: "POLO", designation: "Polo", prixVente: 6_000, axes: [{ nom: "Taille", valeurs: ["S", "M"] }] }, user)),
    ).rejects.toThrow(/POLO-M/);
  });
});
