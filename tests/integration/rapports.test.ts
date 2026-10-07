import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { RAPPORTS } from "@/lib/rapports/registre";
import { creerTiersDans } from "@/modules/tiers/creation";
import { creerCompteDans } from "@/modules/tresorerie/creation";
import { enregistrerMouvementDans } from "@/modules/tresorerie/creation-mouvements";

import { ouvrirBaseDeTest, semerEntreprise } from "./base";

let db: typeof Db;
let fermer: () => Promise<void>;
let org: string;

const aujourdhui = new Date().toISOString().slice(0, 10);
const periode = { du: `${aujourdhui.slice(0, 7)}-01`, au: aujourdhui };

beforeAll(async () => {
  ({ db, fermer } = await ouvrirBaseDeTest());
  let user: string;
  ({ organizationId: org, userId: user } = await semerEntreprise(db));
  const { id: banque } = await db.transaction((tx) => creerCompteDans(tx, org, { nom: "Ecobank", nature: "banque", compte: "5211", seuilAlerte: 0 }, user));
  const { id: client } = await db.transaction((tx) => creerTiersDans(tx, org, { nom: "Sotra", estClient: true }, user));
  await db.transaction((tx) => enregistrerMouvementDans(tx, org, { compteId: banque, nature: "client", montant: 300_000, date: aujourdhui, tiersId: client }, user));
  await db.transaction((tx) => enregistrerMouvementDans(tx, org, { compteId: banque, nature: "frais_bancaires", montant: 2_500, date: aujourdhui }, user));
});
afterAll(async () => fermer());

describe("rapports sur une vraie base", () => {
  it("chaque clé est unique", () => {
    expect(new Set(RAPPORTS.map((r) => r.cle)).size).toBe(RAPPORTS.length);
  });

  // Chaque requête passe par PostgreSQL : une colonne mal nommée casse ici,
  // pas devant le client.
  it.each(RAPPORTS.map((r) => [r.cle, r] as const))("%s s'exécute et rend des lignes conformes à ses colonnes", async (_cle, r) => {
    const resultat = await r.executer(org, periode);
    const cles = new Set(resultat.colonnes.map((c) => c.cle));
    for (const ligne of resultat.lignes) for (const cle of Object.keys(ligne)) expect(cles.has(cle)).toBe(true);
    for (const ligne of resultat.lignes)
      for (const c of resultat.colonnes) {
        const v = ligne[c.cle];
        if (c.type !== "texte" && c.type !== "date" && v !== null && v !== undefined) expect(Number.isInteger(v)).toBe(true);
      }
  });

  it("la trésorerie par compte retombe sur les mouvements saisis", async () => {
    const r = RAPPORTS.find((x) => x.cle === "tresorerie-par-compte")!;
    const { lignes } = await r.executer(org, periode);
    expect(lignes).toEqual([expect.objectContaining({ compte: "Ecobank", ouverture: 0, entrees: 300_000, sorties: 2_500, cloture: 297_500 })]);
  });

  it("la balance générale est équilibrée", async () => {
    const r = RAPPORTS.find((x) => x.cle === "balance-generale")!;
    const { lignes } = await r.executer(org, periode);
    const debit = lignes.reduce((s, l) => s + Number(l.debit), 0);
    const credit = lignes.reduce((s, l) => s + Number(l.credit), 0);
    expect(debit).toBe(credit);
    expect(debit).toBe(302_500);
  });
});
