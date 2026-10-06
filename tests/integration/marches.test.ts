import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import {
  ajouterAvenantPour,
  attribuerPour,
  changerStatutSoumissionPour,
  cocherPiecePour,
  consultationDe,
  creerConsultationPour,
  creerConventionPour,
  creerSoumissionPour,
  enregistrerOffrePour,
  etatMarches,
  inviterPour,
  listerConventions,
  modifierSoumissionPour,
  resilierConventionPour,
  soumissionDe,
} from "@/modules/marches/creation";
import { creerTiersDans } from "@/modules/tiers/creation";

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

describe("répondre à un appel d'offres", () => {
  it("dossier type, alerte de date limite, dépôt refusé tant que le dossier est incomplet", async () => {
    const dans3Jours = new Date(Date.now() + 3 * 86_400_000);
    const { id, numero } = await creerSoumissionPour(org, user, { intitule: "Fourniture d'ordinateurs", autorite: "Mairie de Cocody", type: "public", dateLimite: dans3Jours });
    expect(numero).toMatch(/^AO-\d{4}-00001$/);
    let s = await soumissionDe(org, id);
    expect(s?.dossier.length).toBe(10);
    expect(s?.enDanger).toBe(true);
    expect((await etatMarches(org)).soumissionsEnDanger).toBe(1);

    await changerStatutSoumissionPour(org, user, id, "en_preparation");
    await expect(changerStatutSoumissionPour(org, user, id, "deposee")).rejects.toThrow(/manquent/);
    for (const p of s!.dossier) await cocherPiecePour(org, p.id, true);
    await expect(changerStatutSoumissionPour(org, user, id, "deposee")).rejects.toThrow(/montant/);
    await modifierSoumissionPour(org, user, id, { montantPropose: 12_500_000 });
    await changerStatutSoumissionPour(org, user, id, "deposee");
    s = await soumissionDe(org, id);
    expect(s?.enDanger).toBe(false);

    await expect(changerStatutSoumissionPour(org, user, id, "perdue")).rejects.toThrow(/raison/);
    await changerStatutSoumissionPour(org, user, id, "gagnee");
    await expect(changerStatutSoumissionPour(org, user, id, "perdue", { motif: "x" })).rejects.toThrow();
  });
});

describe("consulter des fournisseurs", () => {
  it("invitations, offres notées, attribution qui écarte les autres", async () => {
    const a = await db.transaction((tx) => creerTiersDans(tx, org, { nom: "Ciments du Sud", estClient: false, estFournisseur: true }));
    const b = await db.transaction((tx) => creerTiersDans(tx, org, { nom: "Bâtir Plus", estClient: false, estFournisseur: true }));
    const { id } = await creerConsultationPour(org, user, { objet: "200 sacs de ciment", poidsPrixBp: 6000 });
    const r = await inviterPour(org, user, id, [a.id, b.id, a.id], null, "Essai");
    expect(r.invites).toBe(2);

    let d = await consultationDe(org, id);
    expect(d?.consultation.statut).toBe("ouverte");
    const offreA = d!.offres.find((o) => o.fournisseur === "Ciments du Sud")!;
    const offreB = d!.offres.find((o) => o.fournisseur === "Bâtir Plus")!;
    await expect(attribuerPour(org, user, offreA.id)).rejects.toThrow(/reçue/);

    await enregistrerOffrePour(org, user, offreA.id, { montant: 1_000_000, noteTechnique: 60 }, null);
    await enregistrerOffrePour(org, user, offreB.id, { montant: 1_250_000, noteTechnique: 100 }, null);
    d = await consultationDe(org, id);
    expect(d?.offres.map((o) => [o.fournisseur, o.note, o.rang])).toEqual([
      ["Bâtir Plus", 88, 1],
      ["Ciments du Sud", 84, 2],
    ]);

    await attribuerPour(org, user, offreB.id);
    d = await consultationDe(org, id);
    expect(d?.consultation.statut).toBe("attribuee");
    expect(Object.fromEntries(d!.offres.map((o) => [o.fournisseur, o.statut]))).toEqual({ "Bâtir Plus": "retenue", "Ciments du Sud": "ecartee" });
    await expect(inviterPour(org, user, id, [a.id], null, "Essai")).rejects.toThrow(/fermée/);
  });
});

describe("conventions", () => {
  it("préavis, avenant qui prolonge, résiliation", async () => {
    const fin = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const { id } = await creerConventionPour(org, user, { intitule: "Maintenance climatisation", sens: "fournisseur", partenaire: "Froid Service", debut: "2026-01-01", fin, preavisJours: 30, montant: 1_200_000 }, null);
    let [c] = (await listerConventions(org)).filter((x) => x.id === id);
    expect(c.etat).toBe("a_renouveler");
    expect((await etatMarches(org)).conventionsARenouveler).toBe(1);

    await ajouterAvenantPour(org, user, id, { objet: "Prolongation d'un an", signeLe: "2026-10-06", nouvelleFin: "2027-12-31", nouveauMontant: 1_350_000 }, null);
    [c] = (await listerConventions(org)).filter((x) => x.id === id);
    expect({ etat: c.etat, fin: c.finEffective, montant: c.montantEffectif, avenants: c.avenants.length }).toEqual({ etat: "en_vigueur", fin: "2027-12-31", montant: 1_350_000, avenants: 1 });

    await expect(resilierConventionPour(org, user, id, "2026-10-06", "")).rejects.toThrow(/motif/);
    await resilierConventionPour(org, user, id, "2026-10-06", "Prestataire défaillant");
    [c] = (await listerConventions(org)).filter((x) => x.id === id);
    expect(c.etat).toBe("resiliee");
    await expect(ajouterAvenantPour(org, user, id, { objet: "Encore", signeLe: "2026-10-07" }, null)).rejects.toThrow(/résiliée/);
  });
});
