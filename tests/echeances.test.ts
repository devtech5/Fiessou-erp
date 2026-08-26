import { describe, expect, it } from "vitest";

import {
  jugerEcheance,
  joursAvant,
  SEUIL_JOURS_PROCHE,
} from "@/modules/actifs/echeance";

const AUJOURDHUI = new Date("2026-08-26T09:00:00Z");

const calendaire = (echeanceLe: string) => ({
  echeanceLe,
  compteurCible: null,
  compteurActuel: null,
});

const auCompteur = (compteurCible: number, compteurActuel: number) => ({
  echeanceLe: null,
  compteurCible,
  compteurActuel,
});

describe("échéance calendaire", () => {
  it("compte les jours restants, et le retard en négatif", () => {
    expect(jugerEcheance(calendaire("2026-08-31"), AUJOURDHUI).joursRestants).toBe(5);
    expect(jugerEcheance(calendaire("2026-08-26"), AUJOURDHUI).joursRestants).toBe(0);
    expect(jugerEcheance(calendaire("2026-08-18"), AUJOURDHUI).joursRestants).toBe(-8);
  });

  it("classe selon le seuil des trente jours", () => {
    expect(jugerEcheance(calendaire("2026-08-18"), AUJOURDHUI).gravite).toBe("depassee");
    expect(jugerEcheance(calendaire("2026-09-12"), AUJOURDHUI).gravite).toBe("proche");
    expect(jugerEcheance(calendaire("2026-11-15"), AUJOURDHUI).gravite).toBe("a_venir");
  });

  /** L'heure de la journée ne doit pas déplacer une échéance d'un jour. */
  it("ne dépend pas de l'heure du jour", () => {
    expect(joursAvant("2026-09-30", new Date("2026-08-26T23:30:00Z"))).toBe(
      joursAvant("2026-09-30", new Date("2026-08-26T00:10:00Z")),
    );
  });
});

describe("échéance au compteur", () => {
  it("mesure ce qu'il reste à parcourir", () => {
    expect(jugerEcheance(auCompteur(90_000, 87_400), AUJOURDHUI).resteCompteur).toBe(
      2_600,
    );
  });

  it("est dépassée quand le seuil est atteint ou franchi", () => {
    expect(jugerEcheance(auCompteur(3_000, 3_000), AUJOURDHUI).gravite).not.toBe(
      "depassee",
    );
    expect(jugerEcheance(auCompteur(3_000, 3_120), AUJOURDHUI).gravite).toBe(
      "depassee",
    );
  });

  /**
   * La marge est relative au seuil, pas absolue. 130 heures avant une révision
   * à 3 000 h laissent le temps de s'organiser ; 130 kilomètres avant une
   * vidange à 90 000 km, non.
   */
  it("juge la proximité à l'échelle du seuil", () => {
    expect(jugerEcheance(auCompteur(3_000, 2_870), AUJOURDHUI).gravite).toBe("proche");
    expect(jugerEcheance(auCompteur(90_000, 87_400), AUJOURDHUI).gravite).toBe(
      "proche",
    );
    expect(jugerEcheance(auCompteur(90_000, 60_000), AUJOURDHUI).gravite).toBe(
      "a_venir",
    );
  });

  it("reste sans jugement quand aucun relevé n'existe", () => {
    const jugement = jugerEcheance(
      { echeanceLe: null, compteurCible: 90_000, compteurActuel: null },
      AUJOURDHUI,
    );
    expect(jugement.gravite).toBe("a_venir");
    expect(jugement.resteCompteur).toBeNull();
    expect(jugement.rang).toBeGreaterThan(1_000);
  });
});

describe("échéance à deux déclencheurs", () => {
  /**
   * Le cas qui commande tout le module : « tous les 5 000 km ou six mois ».
   * Retenir le plus lointain laisserait rouler un véhicule six mois de plus
   * parce qu'il n'a pas atteint son kilométrage.
   */
  it("échoit au PREMIER déclencheur atteint", () => {
    const compteurDepasse = jugerEcheance(
      { echeanceLe: "2026-12-31", compteurCible: 5_000, compteurActuel: 5_400 },
      AUJOURDHUI,
    );
    expect(compteurDepasse.gravite).toBe("depassee");

    const dateDepassee = jugerEcheance(
      { echeanceLe: "2026-08-01", compteurCible: 5_000, compteurActuel: 1_000 },
      AUJOURDHUI,
    );
    expect(dateDepassee.gravite).toBe("depassee");
  });

  it("reste à venir tant qu'aucun des deux n'approche", () => {
    const jugement = jugerEcheance(
      { echeanceLe: "2027-06-30", compteurCible: 5_000, compteurActuel: 500 },
      AUJOURDHUI,
    );
    expect(jugement.gravite).toBe("a_venir");
    expect(jugement.joursRestants).toBeGreaterThan(SEUIL_JOURS_PROCHE);
    expect(jugement.resteCompteur).toBe(4_500);
  });
});

describe("tri des échéances", () => {
  /**
   * Jours et kilomètres se rangent sur la même échelle : sans cela, un
   * entretien à 2 600 km passerait derrière une assurance à 82 jours.
   */
  it("met le plus urgent en tête, quelle que soit la nature", () => {
    const liste = [
      { cle: "assurance-lointaine", ...calendaire("2026-11-15") },
      { cle: "vidange-proche", ...auCompteur(3_000, 2_950) },
      { cle: "visite-depassee", ...calendaire("2026-08-18") },
      { cle: "assurance-proche", ...calendaire("2026-08-31") },
    ];

    const ordre = liste
      .map((e) => ({ cle: e.cle, rang: jugerEcheance(e, AUJOURDHUI).rang }))
      .sort((a, b) => a.rang - b.rang)
      .map((e) => e.cle);

    expect(ordre[0]).toBe("visite-depassee");
    expect(ordre[ordre.length - 1]).toBe("assurance-lointaine");
    expect(ordre.indexOf("vidange-proche")).toBeLessThan(
      ordre.indexOf("assurance-lointaine"),
    );
  });
});
