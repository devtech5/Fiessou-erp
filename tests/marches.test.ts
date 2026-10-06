import { describe, expect, it } from "vitest";

import { ajouterMois, etatConvention, finEffective, joursRestants, noterOffres, soumissionEnDanger } from "@/modules/marches/calcul";

describe("soumissions", () => {
  const maintenant = new Date("2026-10-06T10:00:00Z");
  it("compte les jours restants avant la date limite", () => {
    expect(joursRestants(new Date("2026-10-09T10:00:00Z"), maintenant)).toBe(3);
    expect(joursRestants(new Date("2026-10-05T10:00:00Z"), maintenant)).toBe(-1);
  });
  it("en danger : date proche et dossier incomplet", () => {
    const proche = new Date("2026-10-10T17:00:00Z");
    expect(soumissionEnDanger({ statut: "en_preparation", dateLimite: proche, manquantes: 2 }, maintenant)).toBe(true);
    expect(soumissionEnDanger({ statut: "en_preparation", dateLimite: proche, manquantes: 0 }, maintenant)).toBe(false);
    expect(soumissionEnDanger({ statut: "deposee", dateLimite: proche, manquantes: 2 }, maintenant)).toBe(false);
    expect(soumissionEnDanger({ statut: "veille", dateLimite: new Date("2026-12-01T00:00:00Z"), manquantes: 5 }, maintenant)).toBe(false);
  });
});

describe("notation des offres", () => {
  it("la moins chère a 100 au prix ; la note mêle prix et technique selon le poids annoncé", () => {
    const notes = noterOffres(
      [
        { id: "a", montant: 1_000_000, noteTechnique: 60 },
        { id: "b", montant: 1_250_000, noteTechnique: 90 },
        { id: "c", montant: null, noteTechnique: 100 },
      ],
      6000,
    );
    expect(notes.get("a")).toBe(84); // 100×60 % + 60×40 %
    expect(notes.get("b")).toBe(84); // 80×60 % + 90×40 %
    expect(notes.has("c")).toBe(false);
    expect(noterOffres([{ id: "a", montant: 500, noteTechnique: 0 }], 10_000).get("a")).toBe(100);
  });
});

describe("conventions", () => {
  const base = { debut: "2026-01-01", fin: "2026-12-31", reconductionTacite: false, preavisJours: 60, resilieeLe: null };
  it("en vigueur, à renouveler dans le préavis, expirée", () => {
    expect(etatConvention(base, [], "2026-06-01").etat).toBe("en_vigueur");
    expect(etatConvention(base, [], "2026-11-15")).toMatchObject({ etat: "a_renouveler", jours: 46 });
    expect(etatConvention(base, [], "2027-01-02").etat).toBe("expiree");
    expect(etatConvention({ ...base, debut: "2027-01-01", fin: null }, [], "2026-10-06").etat).toBe("a_venir");
  });
  it("un avenant qui prolonge repousse la fin", () => {
    expect(etatConvention(base, ["2027-12-31"], "2027-01-02")).toMatchObject({ etat: "en_vigueur", fin: "2027-12-31" });
  });
  it("la reconduction tacite court d'année en année", () => {
    expect(finEffective({ ...base, reconductionTacite: true }, [], "2028-03-01")).toBe("2028-12-31");
  });
  it("une résiliation l'emporte", () => {
    expect(etatConvention({ ...base, resilieeLe: "2026-05-01" }, [], "2026-06-01").etat).toBe("resiliee");
  });
  it("ajoute des mois sans déborder du mois", () => {
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2028-02-29", 12)).toBe("2029-02-28");
  });
});
