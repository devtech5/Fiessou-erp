import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { contactPourPiece, contactsParTiers, enregistrerContactDans, retirerContactDans } from "@/modules/tiers/contacts";
import { creerTiersDans } from "@/modules/tiers/creation";
import { contactsTiers } from "@/modules/tiers/schema";

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

describe("contacts d'un tiers", () => {
  it("un seul principal, un contact lié à son seul tiers, un retrait qui garde l'historique", async () => {
    const { id: sococe } = await db.transaction((tx) => creerTiersDans(tx, org, { nom: "SOCOCE" }));
    const { id: autre } = await db.transaction((tx) => creerTiersDans(tx, org, { nom: "Autre client" }));

    const { id: konan } = await db.transaction((tx) => enregistrerContactDans(tx, org, sococe, null, { nom: "Konan Yao", fonction: "Responsable des achats", principal: true }, user));
    const { id: awa } = await db.transaction((tx) => enregistrerContactDans(tx, org, sococe, null, { nom: "Awa Traoré", fonction: "Comptable", principal: true }, user));

    // Le nouveau principal retire le rôle à l'ancien.
    const principaux = await db.select().from(contactsTiers).where(and(eq(contactsTiers.tiersId, sococe), eq(contactsTiers.principal, true)));
    expect(principaux.map((c) => c.id)).toEqual([awa]);
    expect((await contactsParTiers(org)).get(sococe)?.map((c) => c.nom)).toEqual(["Awa Traoré", "Konan Yao"]);

    // Recopié sur la pièce avec sa fonction ; refusé sur un autre tiers.
    expect(await contactPourPiece(db, org, sococe, konan)).toEqual({ contactId: konan, contactNom: "Konan Yao, Responsable des achats" });
    await expect(contactPourPiece(db, org, autre, konan)).rejects.toThrow(/n'appartient pas/);

    // Retiré : il quitte les listes et ne se choisit plus.
    await db.transaction((tx) => retirerContactDans(tx, org, konan, user));
    expect((await contactsParTiers(org)).get(sococe)?.map((c) => c.nom)).toEqual(["Awa Traoré"]);
    await expect(contactPourPiece(db, org, sococe, konan)).rejects.toThrow();
  });
});
