import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { creerTiersDans } from "@/modules/tiers/creation";
import { creerCompteDans } from "@/modules/tresorerie/creation";
import { annulerMouvementDans, enregistrerMouvementDans } from "@/modules/tresorerie/creation-mouvements";
import { ordreVirement, releveCompte } from "@/modules/tresorerie/requetes-mouvements";

import { ouvrirBaseDeTest, semerEntreprise } from "./base";

let db: typeof Db;
let fermer: () => Promise<void>;
let org: string;
let user: string;
let banque: string;
let caisse: string;
let client: string;
let prestataire: string;

const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const aujourdhui = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  ({ db, fermer } = await ouvrirBaseDeTest());
  ({ organizationId: org, userId: user } = await semerEntreprise(db));
  ({ id: banque } = await db.transaction((tx) =>
    creerCompteDans(tx, org, { nom: "SGBCI Plateau", nature: "banque", compte: "5211", seuilAlerte: 0, etablissement: "SGBCI", reference: "CI008 01001 012345678901 23" }, user),
  ));
  ({ id: caisse } = await db.transaction((tx) => creerCompteDans(tx, org, { nom: "Caisse siège", nature: "caisse", compte: "571", seuilAlerte: 0 }, user)));
  ({ id: client } = await db.transaction((tx) => creerTiersDans(tx, org, { nom: "Sotra", estClient: true }, user)));
  ({ id: prestataire } = await db.transaction((tx) => creerTiersDans(tx, org, { nom: "Koné Plomberie", estClient: false, estFournisseur: true }, user)));
});
afterAll(async () => fermer());

describe("mouvements de trésorerie en base", () => {
  it("enregistre entrées et sorties, et le relevé tient le solde", async () => {
    const { numero } = await db.transaction((tx) =>
      enregistrerMouvementDans(tx, org, { compteId: banque, nature: "client", montant: 500_000, date: hier, tiersId: client, reference: "VIR 458" }, user),
    );
    expect(numero).toMatch(/^MVT-\d{4}-00001$/);
    const { id: paiement } = await db.transaction((tx) =>
      enregistrerMouvementDans(tx, org, { compteId: banque, nature: "fournisseur", montant: 120_000, date: aujourdhui, tiersId: prestataire, ribBeneficiaire: "CI042 01002 000111222333 44" }, user),
    );

    const releve = await releveCompte(org, banque, hier, aujourdhui);
    expect(releve).toMatchObject({ ouverture: 0, entrees: 500_000, sorties: 120_000, cloture: 380_000 });
    expect(releve!.lignes.map((l) => l.solde)).toEqual([500_000, 380_000]);
    expect(releve!.lignes[1].mouvement).toMatchObject({ id: paiement, nature: "fournisseur", statut: "valide" });

    const ordre = await ordreVirement(org, paiement);
    expect(ordre).toMatchObject({ montant: 120_000, ribBeneficiaire: "CI042 01002 000111222333 44", beneficiaire: { nom: "Koné Plomberie" }, compte: { nature: "banque" } });
  });

  it("refuse le mauvais tiers, la caisse vide et la date future", async () => {
    // Un client n'a pas de compte 401 : on ne le paie pas comme un fournisseur.
    await expect(db.transaction((tx) => enregistrerMouvementDans(tx, org, { compteId: banque, nature: "fournisseur", montant: 1_000, date: aujourdhui, tiersId: client }, user))).rejects.toThrow(/401/);
    await expect(db.transaction((tx) => enregistrerMouvementDans(tx, org, { compteId: banque, nature: "client", montant: 1_000, date: aujourdhui }, user))).rejects.toThrow(/client/);
    await expect(db.transaction((tx) => enregistrerMouvementDans(tx, org, { compteId: caisse, nature: "frais_bancaires", montant: 1_000, date: aujourdhui }, user))).rejects.toThrow(/ne contient que/);
    await expect(db.transaction((tx) => enregistrerMouvementDans(tx, org, { compteId: banque, nature: "apport", montant: 1_000, date: "2099-01-01" }, user))).rejects.toThrow(/future/);
  });

  it("une annulation contre-passe et ne se fait qu'une fois", async () => {
    const { id } = await db.transaction((tx) => enregistrerMouvementDans(tx, org, { compteId: caisse, nature: "apport", montant: 200_000, date: aujourdhui }, user));
    await expect(db.transaction((tx) => annulerMouvementDans(tx, org, id, "x", user))).rejects.toThrow(/pourquoi/);
    await db.transaction((tx) => annulerMouvementDans(tx, org, id, "Saisi sur la mauvaise caisse", user));
    await expect(db.transaction((tx) => annulerMouvementDans(tx, org, id, "encore une fois", user))).rejects.toThrow(/déjà annulé/);

    const releve = await releveCompte(org, caisse, aujourdhui, aujourdhui);
    // L'apport et son annulation restent visibles, le solde revient à zéro.
    expect(releve!.lignes).toHaveLength(2);
    expect(releve!.cloture).toBe(0);
    expect(releve!.lignes[0].mouvement?.statut).toBe("annule");
    expect(releve!.lignes[1].mouvement).toBeNull();
  });
});
