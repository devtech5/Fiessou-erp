import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import {
  ajouterPrestationPour,
  ajouterVoyageurPour,
  annulerSejourPour,
  arriveePour,
  creerChambrePour,
  departPour,
  modifierDatesPour,
  reglerMenagePour,
  reserverSejourPour,
  verserAcomptePour,
} from "@/modules/hotellerie/creation";
import { ficheSejour, listerSejours, registreVoyageurs, tableauDesChambres } from "@/modules/hotellerie/requetes";
import { remettreDans, reserverDans } from "@/modules/reservations/creation";
import { contratsLocation } from "@/modules/reservations/schema";
import { creerTiersPour } from "@/modules/tiers/creation";

import { ouvrirBaseDeTest, semerEntreprise } from "./base";

let db: typeof Db;
let fermer: () => Promise<void>;
let org: string;
let autre: string;
let user: string;

beforeAll(async () => {
  ({ db, fermer } = await ouvrirBaseDeTest());
  ({ organizationId: org, userId: user } = await semerEntreprise(db));
  ({ organizationId: autre } = await semerEntreprise(db, "Concurrent"));
});
afterAll(async () => fermer());

const VOYAGEUR = { nom: "KOUASSI", prenoms: "Ama", nationalite: "Ivoirienne", pieceNature: "CNI", pieceNumero: "C0123456789" };

/** Solde d'un compte sur toutes les écritures de l'entreprise : débit − crédit. */
async function solde(compte: string): Promise<number> {
  const [l] = await db.execute<{ solde: string }>(sql`
    select coalesce(sum(l.debit - l.credit), 0) as solde
    from lignes_ecriture l join ecritures e on e.id = l.ecriture_id
    where e.organization_id = ${org} and l.compte = ${compte}`);
  return Number(l.solde);
}

describe("hôtel en base", () => {
  it("de la réservation au départ : nuits, note, acompte, ménage et écritures", async () => {
    const { id: chambre, code } = await creerChambrePour(org, { numero: "101", categorie: "Climatisée", etage: "1er", capacite: 2, tarifNuit: 25_000 }, user);
    expect(code).toBe("101");
    await expect(creerChambrePour(org, { numero: "101", capacite: 2, tarifNuit: 25_000 }, user)).rejects.toThrow(/déjà pris/);

    // Trop de monde pour la chambre.
    await expect(
      reserverSejourPour(org, { ressourceId: chambre, nouveauClient: { nom: "Famille Koné" }, arrivee: "2026-10-20", depart: "2026-10-22", adultes: 2, enfants: 1 }, user),
    ).rejects.toThrow(/2 personnes au plus/);

    const sejour = await reserverSejourPour(
      org,
      { ressourceId: chambre, nouveauClient: { nom: "Ama Kouassi", telephone: "0707070707" }, arrivee: "2026-10-20", depart: "2026-10-22", adultes: 1, enfants: 0 },
      user,
    );
    expect(sejour).toMatchObject({ numero: "SEJ-2026-00001", montant: 50_000 });

    // La chambre se revend le jour du départ, pas la veille.
    await expect(
      reserverSejourPour(org, { ressourceId: chambre, nouveauClient: { nom: "Yao" }, arrivee: "2026-10-21", depart: "2026-10-23", adultes: 1, enfants: 0 }, user),
    ).rejects.toThrow(/complet/);
    const suivant = await reserverSejourPour(org, { ressourceId: chambre, nouveauClient: { nom: "Yao" }, arrivee: "2026-10-22", depart: "2026-10-23", adultes: 1, enfants: 0, prixNuit: 20_000 }, user);
    expect(suivant.montant).toBe(20_000);

    // L'écran générique des contrats ne touche pas à un séjour d'hôtel.
    const [contrat] = await db.select().from(contratsLocation).where(eq(contratsLocation.numero, "SEJ-2026-00001"));
    await expect(db.transaction((tx) => remettreDans(tx, org, contrat.id, "especes", user))).rejects.toThrow(/écran Hôtel/);

    // Arrivée : pas avant la date, pas sans fiche de police, pas en chambre sale.
    await expect(arriveePour(org, user, sejour.id, null, "2026-10-19")).rejects.toThrow(/plus tard/);
    await expect(arriveePour(org, user, sejour.id, null, "2026-10-20")).rejects.toThrow(/fiche de police/);
    await ajouterVoyageurPour(org, user, sejour.id, VOYAGEUR);
    await reglerMenagePour(org, user, chambre, "a_faire");
    await expect(arriveePour(org, user, sejour.id, null, "2026-10-20")).rejects.toThrow(/pas faite/);
    await reglerMenagePour(org, user, chambre, "propre");

    const acompte = await verserAcomptePour(org, user, sejour.id, { montant: 20_000, moyen: "mobile_money" }, "2026-10-20");
    expect(acompte.numero).toBe("ACP-2026-00001");
    expect(await arriveePour(org, user, sejour.id, null, "2026-10-20")).toEqual({ ecritureCaution: null });

    const tableau = await tableauDesChambres(org, "2026-10-21");
    expect(tableau.find((c) => c.code === "101")).toMatchObject({ etat: "occupee", sejour: { numero: "SEJ-2026-00001", depart: "2026-10-22" } });

    await ajouterPrestationPour(org, user, sejour.id, { libelle: "Eau minérale", nature: "marchandise", quantite: 2, prixUnitaire: 1_180, tauxTva: 1800 }, "2026-10-21");
    await ajouterPrestationPour(org, user, sejour.id, { libelle: "Blanchisserie", nature: "service", quantite: 1, prixUnitaire: 3_540, tauxTva: 1800 }, "2026-10-21");

    // Prolonger d'une nuit : la chambre est promise au client suivant.
    await expect(modifierDatesPour(org, user, sejour.id, { arrivee: "2026-10-20", depart: "2026-10-23" })).rejects.toThrow(/complet/);

    const depart = await departPour(org, user, sejour.id, { moyen: "especes" }, "2026-10-22");
    expect(depart).toMatchObject({ total: 55_900, reste: 35_900 });

    const fiche = await ficheSejour(org, sejour.id);
    expect(fiche).toMatchObject({ statut: "restitue", note: { total: 55_900, verse: 20_000, reste: 35_900 } });
    expect(fiche?.ecritures).toHaveLength(2);
    expect(await ficheSejour(autre, sejour.id)).toBeNull();

    // L'acompte est sorti du 4191 ; le chiffre est en 706/701, la TVA en 4431.
    expect(await solde("4191")).toBe(0);
    expect(await solde("706")).toBe(-45_373);
    expect(await solde("701")).toBe(-2_000);
    expect(await solde("571")).toBe(35_900);
    expect(await solde("5711")).toBe(20_000);

    // La chambre passe au ménage ; le client suivant arrive.
    expect((await tableauDesChambres(org, "2026-10-22")).find((c) => c.code === "101")?.etat).toBe("arrivee");

    const registre = await registreVoyageurs(org, "2026-10-01", "2026-10-31");
    expect(registre).toHaveLength(1);
    expect(registre[0]).toMatchObject({ nom: "KOUASSI", chambre: "101", arrivee: "2026-10-20", depart: "2026-10-22", parti: true });
    expect(await registreVoyageurs(autre, "2026-10-01", "2026-10-31")).toHaveLength(0);
  });

  it("départ anticipé, caution de résidence et solde à crédit d'une entreprise", async () => {
    const { id: studio } = await creerChambrePour(org, { numero: "S1", designation: "Studio meublé S1", capacite: 2, tarifNuit: 30_000, tarifSemaine: 180_000, caution: 100_000 }, user);
    const { id: entreprise } = await creerTiersPour(org, { nom: "SOTRA", nature: "entreprise" });
    const s = await reserverSejourPour(org, { ressourceId: studio, clientId: entreprise, arrivee: "2026-10-05", depart: "2026-10-15", adultes: 1, enfants: 0 }, user);
    // Dix nuits : une semaine et trois nuits.
    expect(s.montant).toBe(180_000 + 90_000);

    await ajouterVoyageurPour(org, user, s.id, { ...VOYAGEUR, nom: "DIALLO", nationalite: "Malienne" });
    await expect(arriveePour(org, user, s.id, null, "2026-10-05")).rejects.toThrow(/caution/);
    expect((await arriveePour(org, user, s.id, "banque", "2026-10-05")).ecritureCaution).not.toBeNull();

    // Parti le 9 au lieu du 15 : quatre nuits.
    const r = await departPour(org, user, s.id, { moyen: "credit", etat: "endommage", retenue: 15_000 }, "2026-10-09");
    expect(r).toMatchObject({ total: 120_000, reste: 120_000 });
    const fiche = await ficheSejour(org, s.id);
    expect(fiche).toMatchObject({ depart: "2026-10-09", hebergement: 120_000, retenue: 15_000 });
    // Caution rendue moins la retenue, retenue en produit.
    expect(await solde("165")).toBe(0);
    expect(await solde("758")).toBe(-15_000);
  });

  it("annulation : l'acompte se rend ou se garde ; un séjour arrivé ne s'annule pas", async () => {
    const { id: chambre } = await creerChambrePour(org, { numero: "202", capacite: 3, tarifNuit: 40_000 }, user);
    const s = await reserverSejourPour(org, { ressourceId: chambre, nouveauClient: { nom: "Bamba" }, arrivee: "2026-11-01", depart: "2026-11-03", adultes: 2, enfants: 1 }, user);
    await verserAcomptePour(org, user, s.id, { montant: 40_000, moyen: "especes" }, "2026-10-25");
    await expect(annulerSejourPour(org, user, s.id, "Vol annulé", null, "2026-10-28")).rejects.toThrow(/rendu ou conservé/);
    await annulerSejourPour(org, user, s.id, "Vol annulé", "conserver", "2026-10-28");
    expect((await listerSejours(org)).find((x) => x.id === s.id)?.statut).toBe("annule");

    // La chambre est libre de nouveau sur ces dates.
    const s2 = await reserverSejourPour(org, { ressourceId: chambre, nouveauClient: { nom: "Traoré" }, arrivee: "2026-11-01", depart: "2026-11-02", adultes: 1, enfants: 0 }, user);
    await ajouterVoyageurPour(org, user, s2.id, VOYAGEUR);
    await arriveePour(org, user, s2.id, null, "2026-11-01");
    await expect(annulerSejourPour(org, user, s2.id, "Erreur", null, "2026-11-01")).rejects.toThrow(/pas encore arrivée/);

    // Une autre entreprise ne voit ni ne touche ce séjour.
    await expect(verserAcomptePour(autre, user, s2.id, { montant: 1_000, moyen: "especes" }, "2026-11-01")).rejects.toThrow(/introuvable/);
  });

  it("une chambre louée au comptoir bloque aussi l'hôtel", async () => {
    const { id: chambre } = await creerChambrePour(org, { numero: "303", capacite: 2, tarifNuit: 25_000 }, user);
    const { id: client } = await creerTiersPour(org, { nom: "Ouattara" });
    await db.transaction((tx) => reserverDans(tx, org, { ressourceId: chambre, clientId: client, quantite: 1, debut: "2026-12-01", fin: "2026-12-05" }, user));
    await expect(
      reserverSejourPour(org, { ressourceId: chambre, clientId: client, arrivee: "2026-12-04", depart: "2026-12-06", adultes: 1, enfants: 0 }, user),
    ).rejects.toThrow(/complet/);
  });
});
