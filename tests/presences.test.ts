import { describe, expect, it } from "vitest";

import {
  calculerSolde,
  chevauche,
  etatDuJour,
  feriesProposes,
  formatJours,
  heureLocale,
  instantLocal,
  jourLocal,
  jourSemaine,
  joursDecomptes,
  moisComplets,
  paques,
  regleConges,
  retardMinutes,
  type ContexteJour,
} from "@/modules/presences/calcul";

const SANS_FERIE = { decompte: "ouvrables" as const, joursTravailles: [1, 2, 3, 4, 5], feries: new Set<string>() };

describe("fuseau horaire", () => {
  it("rend le jour et l'heure dans le fuseau de l'entreprise", () => {
    const instant = new Date("2026-10-06T23:30:00Z");
    expect(jourLocal(instant, "Africa/Abidjan")).toBe("2026-10-06");
    expect(jourLocal(instant, "Africa/Lagos")).toBe("2026-10-07");
    expect(heureLocale(instant, "Africa/Abidjan")).toBe("23:30");
  });

  it("convertit une heure locale en instant, aller-retour", () => {
    expect(instantLocal("2026-10-06", "08:15", "Africa/Abidjan").toISOString()).toBe("2026-10-06T08:15:00.000Z");
    const lagos = instantLocal("2026-10-06", "08:15", "Africa/Lagos");
    expect(lagos.toISOString()).toBe("2026-10-06T07:15:00.000Z");
    expect(heureLocale(lagos, "Africa/Lagos")).toBe("08:15");
  });
});

describe("retards", () => {
  it("compte le retard au-delà de la tolérance seulement", () => {
    expect(retardMinutes("08:10", "08:00", 15)).toBe(0);
    expect(retardMinutes("08:15", "08:00", 15)).toBe(0);
    expect(retardMinutes("08:16", "08:00", 15)).toBe(16);
    expect(retardMinutes("07:40", "08:00", 0)).toBe(0);
  });
});

describe("jours fériés", () => {
  it("calcule Pâques", () => {
    expect(paques(2024)).toBe("2024-03-31");
    expect(paques(2025)).toBe("2025-04-20");
    expect(paques(2026)).toBe("2026-04-05");
  });

  it("propose les fériés ivoiriens connus d'avance, sans les fêtes lunaires", () => {
    const f = feriesProposes("CI", 2026);
    const jours = Object.fromEntries(f.map((x) => [x.jour, x.libelle]));
    expect(jours["2026-08-07"]).toBe("Fête de l'indépendance");
    expect(jours["2026-11-15"]).toBe("Journée nationale de la paix");
    expect(jours["2026-04-06"]).toBe("Lundi de Pâques");
    expect(jours["2026-05-14"]).toBe("Ascension");
    expect(jours["2026-05-25"]).toBe("Lundi de Pentecôte");
    expect(f).toHaveLength(10);
    expect(f.some((x) => /Tabaski|Korit/.test(x.libelle))).toBe(false);
  });

  it("ne devine rien pour un pays inconnu", () => {
    expect(feriesProposes("XX", 2026)).toEqual([]);
  });
});

describe("décompte des jours de congé", () => {
  it("compte les jours ouvrables : du lundi au samedi", () => {
    // Lundi 5 au dimanche 18 octobre 2026 : 12 jours ouvrables.
    expect(jourSemaine("2026-10-05")).toBe(1);
    expect(joursDecomptes("2026-10-05", "2026-10-18", SANS_FERIE)).toBe(1200);
  });

  it("compte les jours ouvrés : les jours travaillés de l'entreprise", () => {
    expect(joursDecomptes("2026-10-05", "2026-10-18", { ...SANS_FERIE, decompte: "ouvres" })).toBe(1000);
  });

  it("ne décompte pas un férié", () => {
    // Du lundi 3 au samedi 8 août 2026, avec la fête de l'indépendance le vendredi 7.
    expect(joursDecomptes("2026-08-03", "2026-08-08", { ...SANS_FERIE, feries: new Set(["2026-08-07"]) })).toBe(500);
  });

  it("retire les demi-journées", () => {
    expect(joursDecomptes("2026-10-05", "2026-10-07", SANS_FERIE, { debut: true })).toBe(250);
    expect(joursDecomptes("2026-10-05", "2026-10-07", SANS_FERIE, { debut: true, fin: true })).toBe(200);
    expect(joursDecomptes("2026-10-05", "2026-10-05", SANS_FERIE, { fin: true })).toBe(50);
    expect(joursDecomptes("2026-10-05", "2026-10-05", SANS_FERIE, { debut: true, fin: true })).toBe(50);
  });

  it("rend zéro pour une période à l'envers ou un dimanche seul", () => {
    expect(joursDecomptes("2026-10-07", "2026-10-05", SANS_FERIE)).toBe(0);
    expect(joursDecomptes("2026-10-11", "2026-10-11", SANS_FERIE)).toBe(0);
  });
});

describe("solde de congés", () => {
  it("compte les mois de service entiers", () => {
    expect(moisComplets("2026-01-15", "2026-10-06")).toBe(8);
    expect(moisComplets("2026-01-15", "2026-10-15")).toBe(9);
    expect(moisComplets("2026-10-06", "2026-10-01")).toBe(0);
  });

  it("acquiert 2,2 jours par mois en Côte d'Ivoire, en centièmes entiers", () => {
    expect(regleConges("CI").centiemesParMois).toBe(220);
    const s = calculerSolde({ depuis: "2025-10-06", aujourdhui: "2026-10-06", centiemesParMois: 220, reprise: 0, ajustements: 0, pris: 1000, enAttente: 300 });
    expect(s.acquis).toBe(2640);
    expect(s.solde).toBe(1640);
    expect(s.apresDemandes).toBe(1340);
    expect(Number.isInteger(s.solde)).toBe(true);
  });

  it("part d'une reprise et y ajoute les majorations", () => {
    const s = calculerSolde({ depuis: "2026-07-01", aujourdhui: "2026-10-06", centiemesParMois: 220, reprise: 1250, ajustements: 200, pris: 0, enAttente: 0 });
    expect(s.solde).toBe(1250 + 3 * 220 + 200);
  });

  it("affiche les jours sans flottant visible", () => {
    expect(formatJours(2640)).toBe("26,4 j");
    expect(formatJours(50)).toBe("0,5 j");
    expect(formatJours(100)).toBe("1 j");
  });
});

describe("chevauchement", () => {
  it("bornes incluses", () => {
    expect(chevauche({ debut: "2026-10-05", fin: "2026-10-09" }, { debut: "2026-10-09", fin: "2026-10-12" })).toBe(true);
    expect(chevauche({ debut: "2026-10-05", fin: "2026-10-08" }, { debut: "2026-10-09", fin: "2026-10-12" })).toBe(false);
  });
});

describe("état d'un jour au registre", () => {
  const base: ContexteJour = {
    jour: "2026-10-06",
    aujourdhui: "2026-10-07",
    maintenant: "10:00",
    heureArrivee: "08:00",
    tolerance: 15,
    joursTravailles: [1, 2, 3, 4, 5],
    feries: new Map([["2026-08-07", "Fête de l'indépendance"]]),
    contrat: { debut: "2026-01-01", fin: null },
  };

  it("présent, avec ou sans retard", () => {
    expect(etatDuJour({ ...base, presence: { arrivee: "08:05", derniere: "17:00" } })).toEqual({ etat: "present", arrivee: "08:05", derniere: "17:00", retard: 0 });
    expect(etatDuJour({ ...base, presence: { arrivee: "08:40", derniere: "17:00" } })).toMatchObject({ etat: "present", retard: 40 });
  });

  it("absent un jour travaillé passé, sans pointage ni congé", () => {
    expect(etatDuJour(base)).toEqual({ etat: "absent" });
  });

  it("congé, férié, repos, hors contrat", () => {
    expect(etatDuJour({ ...base, conge: "maladie" })).toEqual({ etat: "conge", nature: "maladie" });
    expect(etatDuJour({ ...base, jour: "2026-08-07" })).toEqual({ etat: "ferie", libelle: "Fête de l'indépendance" });
    expect(etatDuJour({ ...base, jour: "2026-10-04" })).toEqual({ etat: "repos" });
    expect(etatDuJour({ ...base, jour: "2025-12-31" })).toEqual({ etat: "hors_contrat" });
  });

  it("ne dit pas « absent » avant l'heure, ni pour un jour à venir", () => {
    expect(etatDuJour({ ...base, jour: "2026-10-07", maintenant: "08:10" })).toEqual({ etat: "avenir" });
    expect(etatDuJour({ ...base, jour: "2026-10-07", maintenant: "09:00" })).toEqual({ etat: "absent" });
    expect(etatDuJour({ ...base, jour: "2026-10-08" })).toEqual({ etat: "avenir" });
  });

  it("une présence pointée l'emporte, même un jour férié", () => {
    expect(etatDuJour({ ...base, jour: "2026-08-07", presence: { arrivee: "09:00", derniere: "12:00" } }).etat).toBe("present");
  });
});
