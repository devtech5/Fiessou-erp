import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { newId } from "@/lib/ids";
import { installerCatalogueDepartPour } from "@/modules/boutique/creation";
import { chiffresDuJour, meilleuresVentes } from "@/modules/boutique/requetes";
import { creerArticlePour } from "@/modules/catalogue/creation";
import { famillesArticle } from "@/modules/catalogue/schema";
import {
  annulerLignePour,
  avancerLignesPour,
  basculerTablePour,
  creerPosteSallePour,
  creerTablePour,
  encaisserCommandePour,
  envoyerLignesPour,
  ouvrirCommandePour,
} from "@/modules/restauration/creation";
import { bonsDeProduction, commandeDetaillee, commandesEnCours, journeeSalle } from "@/modules/restauration/requetes";
import { commandesSalle } from "@/modules/restauration/schema";
import { creerDepotPour, enregistrerMouvementPour } from "@/modules/stock/creation";
import { stocksParArticle } from "@/modules/stock/requetes";
import { posteDeLAppareil } from "@/modules/ventes/requetes";
import { ventes } from "@/modules/ventes/schema";

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

describe("restauration en base", () => {
  it("de la table ouverte au ticket encaissé, stock et chiffre compris", async () => {
    const { id: depot } = await creerDepotPour(org, { nom: "Bar" });
    const { id: biere } = await creerArticlePour(org, { designation: "Bière 65 cl", prixVente: 1_000, prixAchat: 600 });
    const { id: poulet } = await creerArticlePour(org, { designation: "Poulet braisé", type: "service", prixVente: 5_000 });
    await enregistrerMouvementPour(org, { depotId: depot, articleId: biere, type: "reception", quantite: 24_000, coutUnitaire: 600 }, user);

    const { id: poste, code } = await creerPosteSallePour(org, user, { code: "sal", nom: "Salle", depotId: depot });
    expect(code).toBe("SAL");
    // Un poste de salle ne se donne jamais à un terminal de caisse.
    expect(await posteDeLAppareil(org, "appareil-1")).toBeNull();

    const table = await creerTablePour(org, { espace: "maquis", nom: "Baobab", zone: "Terrasse", places: 6 }, user);
    await expect(creerTablePour(org, { espace: "maquis", nom: "Baobab" }, user)).rejects.toThrow(/existe déjà/);

    const ouverture = await ouvrirCommandePour(org, { espace: "maquis", tableId: table }, user, new Date("2026-10-11T20:00:00Z"));
    expect(ouverture.numero).toBe("MQ-2026-00001");
    // Le second serveur qui touche la table retrouve la même addition.
    const seconde = await ouvrirCommandePour(org, { espace: "maquis", tableId: table }, user);
    expect(seconde).toEqual({ id: ouverture.id, numero: ouverture.numero, existante: true });
    // Une table du maquis n'ouvre pas de commande au restaurant.
    await expect(ouvrirCommandePour(org, { espace: "restaurant", tableId: table }, user)).rejects.toThrow(/introuvable/);

    const tournee = [
      { id: newId(), articleId: biere, quantite: 3_000, poste: "bar" as const },
      { id: newId(), articleId: poulet, quantite: 1_000, note: "bien pimenté", poste: "cuisine" as const },
    ];
    expect(await envoyerLignesPour(org, user, ouverture.id, tournee)).toEqual({ envoyees: 2 });
    // Réseau qui hoquette : le renvoi ne double pas la tournée.
    expect(await envoyerLignesPour(org, user, ouverture.id, tournee)).toEqual({ envoyees: 0 });

    const bons = await bonsDeProduction(org, "maquis", "cuisine");
    expect(bons).toHaveLength(1);
    expect(bons[0].lignes.map((l) => l.designation)).toEqual(["Poulet braisé"]);
    expect(bons[0].repere).toBe("Table Baobab");

    // Le restaurant ne voit pas les bons du maquis, et ne peut pas les avancer.
    expect(await bonsDeProduction(org, "restaurant")).toEqual([]);
    expect(await avancerLignesPour(org, user, "restaurant", [tournee[1].id], "prete")).toEqual({ avancees: 0 });

    expect(await avancerLignesPour(org, user, "maquis", [tournee[1].id], "prete")).toEqual({ avancees: 1 });
    const [enCours] = await commandesEnCours(org, "maquis");
    expect(enCours.total).toBe(8_000);
    expect(enCours.lignesPretes).toBe(1);

    // Une bière de trop : annulée, elle reste au dossier mais ne se facture plus.
    const enTrop = newId();
    await envoyerLignesPour(org, user, ouverture.id, [{ id: enTrop, articleId: biere, quantite: 1_000, poste: "bar" }]);
    await expect(annulerLignePour(org, user, enTrop, "")).rejects.toThrow(/pourquoi/);
    await annulerLignePour(org, user, enTrop, "Commandée deux fois");
    const detail = await commandeDetaillee(org, ouverture.id);
    expect(detail?.lignes).toHaveLength(3);
    expect(detail?.total).toBe(8_000);

    // Une table occupée ne se retire pas du plan.
    await expect(basculerTablePour(org, user, table, false)).rejects.toThrow(/ouverte/);

    // Les règlements doivent tomber juste.
    await expect(
      encaisserCommandePour(org, user, { commandeId: ouverture.id, posteId: poste, reglements: [{ moyen: "especes", montant: 7_000 }] }),
    ).rejects.toThrow(/totalisent/);

    const vente = await encaisserCommandePour(
      org,
      user,
      {
        commandeId: ouverture.id,
        posteId: poste,
        reglements: [
          { moyen: "especes", montant: 5_000 },
          { moyen: "mobile_money", montant: 3_000, reference: "Wave 7XK92" },
        ],
        especesRecues: 10_000,
      },
      new Date("2026-10-11T22:30:00Z"),
    );
    expect(vente.numero).toBe("SAL-000001");
    expect(vente.totalTtc).toBe(8_000);
    expect(vente.commande).toBe("MQ-2026-00001");

    const [ticket] = await db.select().from(ventes).where(eq(ventes.id, vente.id));
    expect(ticket.monnaieRendue).toBe(5_000);
    const [close] = await db.select().from(commandesSalle).where(eq(commandesSalle.id, ouverture.id));
    expect(close.statut).toBe("encaissee");
    expect(close.venteId).toBe(vente.id);

    // La bière sort du stock par la vente, une seule fois ; le plat n'a pas de stock.
    expect((await stocksParArticle(org)).get(biere)?.quantite).toBe(21_000);

    // Encaisser deux fois la même table : refusé.
    await expect(
      encaisserCommandePour(org, user, { commandeId: ouverture.id, posteId: poste, reglements: [{ moyen: "especes", montant: 8_000 }] }),
    ).rejects.toThrow(/déjà encaissée/);

    // La table est libre : une nouvelle commande prend le numéro suivant.
    const suivante = await ouvrirCommandePour(org, { espace: "maquis", tableId: table }, user, new Date("2026-10-11T23:00:00Z"));
    expect(suivante.existante).toBe(false);
    expect(suivante.numero).toBe("MQ-2026-00002");

    // Ce qui n'est pas servi reste sur le bon, même payé : le poulet prêt et
    // les bières jamais marquées servies.
    expect((await bonsDeProduction(org, "maquis")).find((b) => b.commandeId === ouverture.id)?.lignes).toHaveLength(2);
    expect(await avancerLignesPour(org, user, "maquis", tournee.map((l) => l.id), "servie")).toEqual({ avancees: 2 });
    expect((await bonsDeProduction(org, "maquis")).find((b) => b.commandeId === ouverture.id)).toBeUndefined();

    const journee = await journeeSalle(org, "maquis", new Date("2026-10-11T00:00:00Z"));
    expect(journee).toMatchObject({ commandesEncaissees: 1, chiffreAffaires: 8_000, ticketMoyen: 8_000, annulees: 0 });

    // Le commerce lit la même vente.
    const jour = await chiffresDuJour(org, "2026-10-11");
    expect(jour).toMatchObject({ tickets: 1, chiffreAffaires: 8_000, panierMoyen: 8_000 });
    // Bière : 3 × 1 000 TTC, soit 2 542 HT pour 1 800 de coût ; poulet sans coût.
    expect(jour.margeBrute).toBe(jour.ventesHt - 1_800);
    const top = await meilleuresVentes(org, "2026-10-05", "2026-10-11");
    expect(top.map((a) => a.designation)).toEqual(["Poulet braisé", "Bière 65 cl"]);
  });

  it("une commande à emporter porte un nom", async () => {
    await expect(ouvrirCommandePour(org, { espace: "restaurant", tableId: null }, user)).rejects.toThrow(/nom/);
    const c = await ouvrirCommandePour(org, { espace: "restaurant", libelle: "Awa, moto rouge" }, user, new Date("2026-10-11T12:00:00Z"));
    expect(c.numero).toBe("CMD-2026-00001");
  });

  it("installe les familles du commerce une seule fois", async () => {
    expect(await installerCatalogueDepartPour(org, user)).toEqual({ creees: 6 });
    expect(await installerCatalogueDepartPour(org, user)).toEqual({ creees: 0 });
    const familles = await db.select().from(famillesArticle).where(and(eq(famillesArticle.organizationId, org), eq(famillesArticle.code, "BOIS")));
    expect(familles[0]).toMatchObject({ nom: "Boissons", tauxTva: 1800, compteVente: "701" });
  });
});
