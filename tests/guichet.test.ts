import { describe, expect, it } from "vitest";

import { estEquilibree, totalDebit } from "@/lib/comptabilite/ecritures";
import {
  commissionIndicative,
  ecartsOuverture,
  ecritureApportOuverture,
  ecritureClotureGuichet,
  effetSurEspeces,
  effetSurFloat,
  messageOuverture,
  ouvertureAttendue,
  rapprocher,
  refusOperation,
  soldes,
  type OperationComptee,
} from "@/modules/monnaie/calcul";

const ouverture = { floats: { wave: 1_000_000, orange: 500_000, mtn: 350_000, moov: 100_000 }, fondCaisse: 250_000 };

const journee: OperationComptee[] = [
  { type: "depot", reseau: "wave", montant: 50_000, commission: 300 },
  { type: "retrait", reseau: "orange", montant: 25_000, commission: 250 },
  { type: "credit", reseau: "mtn", montant: 1_000, commission: 50 },
  { type: "retrait", reseau: "moov", montant: 40_000, commission: 300 },
  { type: "approvisionnement", reseau: "wave", montant: 100_000, commission: 0 },
  // Saisie par erreur puis annulée : elle ne compte plus nulle part.
  { type: "depot", reseau: "orange", montant: 999_000, commission: 9_000, annulee: true },
];

describe("effet des opérations", () => {
  it("fait toujours aller float et espèces en sens contraire", () => {
    for (const type of ["depot", "retrait", "credit", "approvisionnement", "destockage"] as const) {
      expect(effetSurFloat(type, 10_000) + effetSurEspeces(type, 10_000)).toBe(0);
    }
    expect(effetSurFloat("depot", 10_000)).toBe(-10_000);
    expect(effetSurEspeces("retrait", 10_000)).toBe(-10_000);
  });

  it("déduit les soldes de l'ouverture et des opérations", () => {
    const s = soldes(ouverture, journee);
    expect(s.floats).toEqual({ wave: 1_050_000, orange: 525_000, mtn: 349_000, moov: 140_000 });
    expect(s.especes).toBe(250_000 + 50_000 - 25_000 + 1_000 - 40_000 - 100_000);
    expect(s.commissions).toBe(900);
  });

  it("garde l'invariant : float + espèces constant hors commissions", () => {
    const s = soldes(ouverture, journee);
    const avant = Object.values(ouverture.floats).reduce((a, b) => a + b, 0) + ouverture.fondCaisse;
    const apres = Object.values(s.floats).reduce((a, b) => a + b, 0) + s.especes;
    expect(apres).toBe(avant);
  });
});

describe("contrôle avant validation", () => {
  const s = soldes(ouverture, []);

  it("refuse un dépôt que le float ne couvre pas", () => {
    expect(refusOperation(s, { type: "depot", reseau: "moov", montant: 100_001 })).toMatch(/Float Moov Money insuffisant/);
    expect(refusOperation(s, { type: "depot", reseau: "moov", montant: 100_000 })).toBeNull();
  });

  it("refuse un retrait que le tiroir ne couvre pas", () => {
    expect(refusOperation(s, { type: "retrait", reseau: "wave", montant: 250_001 })).toMatch(/Espèces insuffisantes/);
    expect(refusOperation(s, { type: "retrait", reseau: "wave", montant: 250_000 })).toBeNull();
  });

  it("refuse un montant nul, négatif ou fractionnaire", () => {
    expect(refusOperation(s, { type: "depot", reseau: "wave", montant: 0 })).toBe("Montant invalide.");
    expect(refusOperation(s, { type: "depot", reseau: "wave", montant: -5 })).toBe("Montant invalide.");
    expect(refusOperation(s, { type: "depot", reseau: "wave", montant: 10.5 })).toBe("Montant invalide.");
  });
});

describe("commission indicative", () => {
  it("suit le barème par tranche", () => {
    expect(commissionIndicative("depot", 5_000)).toBe(50);
    expect(commissionIndicative("retrait", 5_001)).toBe(100);
    expect(commissionIndicative("depot", 1_000_000)).toBe(1_500);
  });

  it("ne rémunère pas les mouvements de trésorerie de l'agent", () => {
    expect(commissionIndicative("approvisionnement", 500_000)).toBe(0);
    expect(commissionIndicative("destockage", 500_000)).toBe(0);
  });

  it("donne une remise entière sur le crédit", () => {
    expect(commissionIndicative("credit", 1_000)).toBe(50);
    expect(commissionIndicative("credit", 510)).toBe(25);
  });
});

describe("rapprochement et clôture", () => {
  const s = soldes(ouverture, journee);

  it("mesure l'écart compté moins attendu", () => {
    const r = rapprocher(s, s.especes - 2_000, { wave: 1_050_000, orange: null });
    expect(r.ecartEspeces).toBe(-2_000);
    expect(r.floats.find((f) => f.reseau === "wave")?.ecart).toBe(0);
    expect(r.floats.find((f) => f.reseau === "orange")?.ecart).toBeNull();
  });

  const variations = { wave: 50_000, orange: 25_000, mtn: -1_000, moov: 40_000 };

  it("passe une écriture équilibrée, commissions en produit", () => {
    const e = ecritureClotureGuichet({ numero: "GUI-2026-00001", date: "2026-10-04", variationsFloat: variations, commissions: 900, ecartEspeces: 0 })!;
    expect(estEquilibree(e)).toBe(true);
    expect(e.lignes.filter((l) => l.compte === "5712")).toHaveLength(4);
    expect(e.lignes.find((l) => l.compte === "571")?.credit).toBe(114_000);
    expect(e.lignes.find((l) => l.compte === "706")?.credit).toBe(900);
    expect(e.lignes.find((l) => l.compte === "4718")?.debit).toBe(900);
  });

  it("passe un manquant en charge et un excédent en produit", () => {
    const manquant = ecritureClotureGuichet({ numero: "G", date: "2026-10-04", variationsFloat: variations, commissions: 0, ecartEspeces: -2_000 })!;
    expect(estEquilibree(manquant)).toBe(true);
    expect(manquant.lignes.find((l) => l.compte === "658")?.debit).toBe(2_000);
    expect(manquant.lignes.find((l) => l.compte === "571")?.credit).toBe(116_000);

    const excedent = ecritureClotureGuichet({ numero: "G", date: "2026-10-04", variationsFloat: {}, commissions: 0, ecartEspeces: 500 })!;
    expect(estEquilibree(excedent)).toBe(true);
    expect(excedent.lignes.find((l) => l.compte === "758")?.credit).toBe(500);
    expect(totalDebit(excedent)).toBe(500);
  });

  it("ne passe rien pour une journée blanche", () => {
    expect(ecritureClotureGuichet({ numero: "G", date: "2026-10-04", variationsFloat: {}, commissions: 0, ecartEspeces: 0 })).toBeNull();
  });
});

describe("apport de l'exploitant à l'ouverture", () => {
  it("passe tout le float et le fond de la première session en apport", () => {
    const e = ecritureApportOuverture({
      numero: "GUI-2026-00001",
      date: "2026-10-03",
      declare: { especes: 250_000, floats: { wave: 1_000_000, orange: 500_000, mtn: 350_000, moov: 200_000 } },
      attendu: ouvertureAttendue(null),
    })!;
    expect(estEquilibree(e)).toBe(true);
    expect(e.piece).toBe("GUI-2026-00001-O");
    expect(e.libelle).toMatch(/^Apport de l'exploitant/);
    expect(e.lignes.filter((l) => l.compte === "5712").map((l) => l.debit)).toEqual([1_000_000, 500_000, 350_000, 200_000]);
    expect(e.lignes.find((l) => l.compte === "571")?.debit).toBe(250_000);
    expect(e.lignes.find((l) => l.compte === "104")?.credit).toBe(2_300_000);
  });

  it("ne passe rien quand l'ouverture reprend exactement la clôture", () => {
    const laisse = { especesComptees: 75_500, floats: { wave: 1_055_000, orange: 425_000, mtn: 354_000, moov: 160_000 } };
    expect(
      ecritureApportOuverture({
        numero: "GUI-2026-00002",
        date: "2026-10-04",
        declare: { especes: 75_500, floats: laisse.floats },
        attendu: ouvertureAttendue(laisse),
      }),
    ).toBeNull();
  });

  it("passe un apport partiel et un prélèvement dans le bon sens", () => {
    const laisse = { especesComptees: 100_000, floats: { wave: 500_000 } };
    const apport = ecritureApportOuverture({
      numero: "G2",
      date: "2026-10-04",
      declare: { especes: 100_000, floats: { wave: 700_000 } },
      attendu: ouvertureAttendue(laisse),
    })!;
    expect(apport.lignes.find((l) => l.compte === "104")?.credit).toBe(200_000);

    const prelevement = ecritureApportOuverture({
      numero: "G3",
      date: "2026-10-04",
      declare: { especes: 40_000, floats: { wave: 500_000 } },
      attendu: ouvertureAttendue(laisse),
    })!;
    expect(estEquilibree(prelevement)).toBe(true);
    expect(prelevement.libelle).toMatch(/^Prélèvement/);
    expect(prelevement.lignes.find((l) => l.compte === "571")?.credit).toBe(60_000);
    expect(prelevement.lignes.find((l) => l.compte === "104")?.debit).toBe(60_000);
  });
});

describe("message d'ouverture", () => {
  const laisse = ouvertureAttendue({ especesComptees: 100_000, floats: { wave: 500_000, orange: 200_000 } });

  it("annonce un apport, réseau par réseau", () => {
    const e = ecartsOuverture({ especes: 100_000, floats: { wave: 550_000, orange: 200_000 } }, laisse);
    expect(e.total).toBe(50_000);
    expect(messageOuverture(e, false)).toMatch(/^Apport de l'exploitant de 50.000 F \(Wave \+ 50.000\)\.$/);
  });

  it("annonce un prélèvement", () => {
    const e = ecartsOuverture({ especes: 60_000, floats: { wave: 500_000, orange: 200_000 } }, laisse);
    expect(messageOuverture(e, false)).toMatch(/^Prélèvement de l'exploitant de 40.000 F \(espèces − 40.000\)\.$/);
  });

  it("se tait quand l'ouverture reprend la clôture", () => {
    const e = ecartsOuverture({ especes: 100_000, floats: { wave: 500_000, orange: 200_000 } }, laisse);
    expect(messageOuverture(e, false)).toBeNull();
  });

  it("signale un transfert entre réserves sans apport net", () => {
    const e = ecartsOuverture({ especes: 50_000, floats: { wave: 550_000, orange: 200_000 } }, laisse);
    expect(e.total).toBe(0);
    expect(messageOuverture(e, false)).toMatch(/^Pas d'apport net/);
  });

  it("précise la première ouverture", () => {
    const e = ecartsOuverture({ especes: 250_000, floats: { wave: 1_000_000 } }, ouvertureAttendue(null));
    expect(messageOuverture(e, true)).toMatch(/première ouverture/);
  });
});
