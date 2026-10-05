import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import type { db as Db } from "@/db";
import { newId } from "@/lib/ids";
import { soldesParCompte } from "@/modules/comptabilite/requetes";
import { encaisserDans } from "@/modules/facturation/creation";
import { piecesCommerciales } from "@/modules/facturation/schema";
import { lireArticles, lireStock, lireTiers, MODELES } from "@/modules/reprise/calcul";
import { importerArticlesDans, importerStockDans, importerTiersDans, reprendreTresorerieDans } from "@/modules/reprise/creation";
import { depots } from "@/modules/stock/schema";
import { soldesParAuxiliaire } from "@/modules/tiers/requetes";
import { comptesTresorerie } from "@/modules/tresorerie/schema";

import { ouvrirBaseDeTest, semerEntreprise } from "./base";

let db: typeof Db;
let fermer: () => Promise<void>;
let org: string;
let user: string;
const DATE = "2026-09-30";

beforeAll(async () => {
  ({ db, fermer } = await ouvrirBaseDeTest());
  ({ organizationId: org, userId: user } = await semerEntreprise(db));
  await db.insert(depots).values({ id: newId(), organizationId: org, code: "MAG", nom: "Magasin principal", parDefaut: true });
});
afterAll(async () => fermer());

describe("reprise de l'existant", () => {
  it("importe articles, tiers avec soldes, stock et trésorerie, tout contre le 4711", async () => {
    const a = await db.transaction((tx) => importerArticlesDans(tx, org, lireArticles(MODELES.articles).articles, user));
    expect(a.crees).toBe(2);
    // Relancé, rien n'est créé deux fois.
    expect((await db.transaction((tx) => importerArticlesDans(tx, org, lireArticles(MODELES.articles).articles, user))).ignores).toHaveLength(2);

    const t = await db.transaction((tx) => importerTiersDans(tx, org, lireTiers(MODELES.tiers).tiers, DATE, user));
    expect(t).toMatchObject({ crees: 2, creances: 1, montantCreances: 350_000, dettes: 1, montantDettes: 1_200_000 });

    const s = await db.transaction((tx) => importerStockDans(tx, org, lireStock(MODELES.stock).stock, DATE, user));
    expect(s.valeur).toBe(120 * 4600);

    const caisse = newId();
    await db.insert(comptesTresorerie).values({ id: caisse, organizationId: org, nom: "Caisse", nature: "caisse", compte: "571" });
    await db.transaction((tx) => reprendreTresorerieDans(tx, org, { compteTresorerieId: caisse, solde: 85_000, date: DATE }, user));
    await expect(db.transaction((tx) => reprendreTresorerieDans(tx, org, { compteTresorerieId: caisse, solde: 1, date: DATE }, user))).rejects.toThrow(/déjà repris/);

    const soldes = await soldesParCompte(org, "2026");
    const solde = (c: string) => soldes.filter((x) => x.compte === c).reduce((n, x) => n + x.debit - x.credit, 0);
    // Situation nette : créance + stock + caisse − dette.
    expect(-solde("4711")).toBe(350_000 + 552_000 + 85_000 - 1_200_000);
    expect(solde("311")).toBe(552_000);

    // La créance reprise est une facture comme une autre : elle s'encaisse.
    const auxiliaires = await soldesParAuxiliaire(org);
    expect([...auxiliaires.values()].reduce((n, x) => n + x.encoursClient, 0)).toBe(350_000);
    const [facture] = await db.select().from(piecesCommerciales).where(eq(piecesCommerciales.organizationId, org));
    const r = await db.transaction((tx) => encaisserDans(tx, org, { pieceId: facture.id, montant: 100_000, moyen: "especes", date: "2026-10-02", compteTresorerieId: caisse }, user));
    expect(r.reste).toBe(250_000);
  });
});
