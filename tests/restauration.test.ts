import { describe, expect, it } from "vitest";

import { heureDePointe, libelleVariation, plageAffluence, variationBp } from "@/modules/boutique/calcul";
import {
  enRetard,
  etatTable,
  libelleDuree,
  minutesDepuis,
  passagePermis,
  posteParDefaut,
  totalCommande,
} from "@/modules/restauration/calcul";

describe("lignes de commande", () => {
  it("n'avance que dans le sens du service", () => {
    expect(passagePermis("envoyee", "prete")).toBe(true);
    // La bière posée au comptoir passe directement à servie.
    expect(passagePermis("envoyee", "servie")).toBe(true);
    expect(passagePermis("prete", "envoyee")).toBe(false);
    expect(passagePermis("servie", "prete")).toBe(false);
    expect(passagePermis("annulee", "servie")).toBe(false);
    expect(passagePermis("servie", "annulee")).toBe(true);
  });

  it("ne facture pas les lignes annulées, et arrondit au franc à la multiplication", () => {
    expect(
      totalCommande([
        { quantite: 3_000, prixUnitaire: 1_000, etat: "servie" },
        { quantite: 1_000, prixUnitaire: 5_000, etat: "envoyee" },
        { quantite: 2_000, prixUnitaire: 1_000, etat: "annulee" },
        // 1,340 kg de poisson à 4 500 F le kilo : 6 030 F.
        { quantite: 1_340, prixUnitaire: 4_500, etat: "prete" },
      ]),
    ).toBe(14_030);
    expect(totalCommande([])).toBe(0);
  });

  it("envoie la boisson stockée au bar et le plat en cuisine", () => {
    expect(posteParDefaut({ service: false })).toBe("bar");
    expect(posteParDefaut({ service: true })).toBe("cuisine");
  });
});

describe("temps du service", () => {
  const debut = new Date("2026-10-11T20:00:00Z");

  it("compte en minutes entières, sans jamais reculer", () => {
    expect(minutesDepuis(debut, new Date("2026-10-11T20:07:59Z"))).toBe(7);
    expect(minutesDepuis(debut, new Date("2026-10-11T19:59:00Z"))).toBe(0);
    expect(libelleDuree(8)).toBe("8 min");
    expect(libelleDuree(65)).toBe("1 h 05");
  });

  it("signale le plat oublié en cuisine après vingt minutes, la boisson après dix", () => {
    const a = (poste: "cuisine" | "bar", etat: "envoyee" | "prete" = "envoyee") => ({ poste, etat, envoyeeLe: debut });
    const apres = (minutes: number) => new Date(debut.getTime() + minutes * 60_000);
    expect(enRetard(a("bar"), apres(10))).toBe(true);
    expect(enRetard(a("cuisine"), apres(10))).toBe(false);
    expect(enRetard(a("cuisine"), apres(20))).toBe(true);
    expect(enRetard(a("cuisine", "prete"), apres(60))).toBe(false);
  });

  it("met en évidence la table dont un plat attend", () => {
    expect(etatTable(null)).toBe("libre");
    expect(etatTable({ lignesPretes: 0 })).toBe("occupee");
    expect(etatTable({ lignesPretes: 2 })).toBe("a_servir");
  });
});

describe("tableau de bord du commerce", () => {
  it("exprime l'écart en points de base, sans référence vide", () => {
    expect(variationBp(112_500, 100_000)).toBe(1_250);
    expect(variationBp(97_000, 100_000)).toBe(-300);
    expect(variationBp(50_000, 0)).toBeNull();
    expect(libelleVariation(1_250)).toBe("+12,5 %");
    expect(libelleVariation(-300)).toBe("−3,0 %");
    expect(libelleVariation(0)).toBe("0,0 %");
  });

  it("garde les heures creuses visibles et élargit à 8 h – 20 h", () => {
    const plage = plageAffluence([
      { heure: 9, tickets: 4, montant: 12_000 },
      { heure: 12, tickets: 9, montant: 30_000 },
      { heure: 21, tickets: 2, montant: 3_000 },
    ]);
    expect(plage.map((h) => h.heure)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(plage.find((h) => h.heure === 10)).toEqual({ heure: 10, tickets: 0, montant: 0 });
    expect(heureDePointe(plage)?.heure).toBe(12);
    expect(heureDePointe(plageAffluence([]))).toBeNull();
  });
});
