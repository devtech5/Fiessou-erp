import { describe, expect, it } from "vitest";

import { estEquilibree, totalCredit } from "@/lib/comptabilite/ecritures";
import {
  departDe,
  derniereNuit,
  ecritureAcompte,
  ecritureAnnulation,
  ecritureDepart,
  etatChambre,
  nuitsEntre,
  periodeContrat,
  prixSejour,
  recapTva,
  soldeNote,
  tauxOccupation,
} from "@/modules/hotellerie/calcul";

const GRILLE = { tarifJour: 25_000, tarifSemaine: 150_000, tarifMois: 450_000 };

describe("nuits et période du contrat", () => {
  it("compte les nuits, pas les jours, et libère la chambre le jour du départ", () => {
    expect(nuitsEntre("2026-10-20", "2026-10-22")).toBe(2);
    expect(periodeContrat("2026-10-20", "2026-10-22")).toEqual({ debut: "2026-10-20", fin: "2026-10-21" });
    expect(departDe("2026-10-21")).toBe("2026-10-22");
    // Fin de mois : la veille du 1er novembre est le 31 octobre.
    expect(periodeContrat("2026-10-30", "2026-11-01").fin).toBe("2026-10-31");
    expect(() => periodeContrat("2026-10-20", "2026-10-20")).toThrow(/au moins une nuit/);
  });

  it("facture la nuit d'un client qui repart le jour même", () => {
    expect(derniereNuit("2026-10-20", "2026-10-20")).toBe("2026-10-20");
    expect(derniereNuit("2026-10-20", "2026-10-23")).toBe("2026-10-22");
  });
});

describe("prix du séjour", () => {
  it("suit la grille : la semaine et le mois sont des forfaits", () => {
    expect(prixSejour(GRILLE, null, 2)).toEqual({ montant: 50_000, base: "jour" });
    expect(prixSejour(GRILLE, null, 9)).toEqual({ montant: 200_000, base: "semaine" });
    expect(prixSejour(GRILLE, null, 30)).toEqual({ montant: 450_000, base: "mois" });
  });

  it("applique le tarif négocié à la nuit, sans forfait", () => {
    expect(prixSejour(GRILLE, 20_000, 9)).toEqual({ montant: 180_000, base: "negocie" });
    expect(prixSejour(GRILLE, 0, 3)).toEqual({ montant: 0, base: "negocie" });
    expect(prixSejour(GRILLE, null, 0)).toBeNull();
  });
});

describe("état des chambres", () => {
  const base = { statut: "active" as const, menage: "propre" as const, departPrevu: null, arriveeAttendue: false };
  const jour = "2026-10-20";

  it("distingue occupée, départ, arrivée, à nettoyer, libre, hors service", () => {
    expect(etatChambre({ ...base, departPrevu: "2026-10-22" }, jour)).toBe("occupee");
    expect(etatChambre({ ...base, departPrevu: "2026-10-20" }, jour)).toBe("depart");
    // Départ dépassé : toujours un départ, la réception doit le voir.
    expect(etatChambre({ ...base, departPrevu: "2026-10-19" }, jour)).toBe("depart");
    expect(etatChambre({ ...base, arriveeAttendue: true, menage: "a_faire" }, jour)).toBe("arrivee");
    expect(etatChambre({ ...base, menage: "a_faire" }, jour)).toBe("a_nettoyer");
    expect(etatChambre(base, jour)).toBe("libre");
    expect(etatChambre({ ...base, statut: "maintenance" }, jour)).toBe("hors_service");
  });

  it("calcule le taux d'occupation sur les chambres en service", () => {
    expect(tauxOccupation(7, 10)).toBe(70);
    expect(tauxOccupation(1, 3)).toBe(33);
    expect(tauxOccupation(0, 0)).toBe(0);
  });
});

describe("note et écritures", () => {
  it("déduit les acomptes de la note", () => {
    expect(soldeNote(50_000, [{ montant: 3_000 }, { montant: 2_000 }], [{ montant: 20_000 }])).toEqual({ total: 55_000, verse: 20_000, reste: 35_000 });
  });

  it("met l'acompte en 4191, pas en recette", () => {
    const e = ecritureAcompte({ numero: "ACP-2026-00001", date: "2026-10-20", client: "Kouassi", montant: 20_000, moyen: "mobile_money" });
    expect(e.lignes.map((l) => [l.compte, l.debit, l.credit])).toEqual([
      ["5711", 20_000, 0],
      ["4191", 0, 20_000],
    ]);
  });

  it("solde le départ : acomptes repris, hébergement et prestations ventilés, TVA extraite", () => {
    const e = ecritureDepart({
      numero: "SEJ-2026-00001",
      date: "2026-10-22",
      client: "Kouassi",
      lignes: [
        { montant: 50_000, tauxTvaBp: 1800, nature: "service" },
        { montant: 2_360, tauxTvaBp: 1800, nature: "marchandise" },
        { montant: 3_540, tauxTvaBp: 1800, nature: "service" },
      ],
      acomptes: 20_000,
      moyen: "especes",
    });
    expect(estEquilibree(e)).toBe(true);
    const parCompte = Object.fromEntries(e.lignes.map((l) => [l.compte, l.debit - l.credit]));
    expect(parCompte["4191"]).toBe(20_000);
    expect(parCompte["571"]).toBe(35_900);
    // 53 540 TTC de services → 45 373 HT ; 2 360 TTC de boissons → 2 000 HT.
    expect(parCompte["706"]).toBe(-45_373);
    expect(parCompte["701"]).toBe(-2_000);
    expect(parCompte["4431"]).toBe(-(55_900 - 45_373 - 2_000));
  });

  it("affiche sur la facture la TVA que l'écriture comptabilise", () => {
    const lignes = [
      { montant: 50_000, tauxTvaBp: 1800, nature: "service" as const },
      { montant: 2_360, tauxTvaBp: 1800, nature: "marchandise" as const },
      { montant: 3_540, tauxTvaBp: 1800, nature: "service" as const },
      { montant: 1_000, tauxTvaBp: 0, nature: "service" as const },
    ];
    const recap = recapTva(lignes);
    expect(recap).toEqual([
      { tauxTvaBp: 1800, ttc: 55_900, ht: 47_373, tva: 8_527 },
      { tauxTvaBp: 0, ttc: 1_000, ht: 1_000, tva: 0 },
    ]);
    const e = ecritureDepart({ numero: "S", date: "2026-10-22", client: "K", lignes, acomptes: 0, moyen: "especes" });
    expect(e.lignes.find((l) => l.compte === "4431")?.credit).toBe(8_527);
  });

  it("rend le trop-perçu, et refuse un trop-perçu laissé à crédit", () => {
    const lignes = [{ montant: 25_000, tauxTvaBp: 1800, nature: "service" as const }];
    const e = ecritureDepart({ numero: "SEJ-2026-00002", date: "2026-10-21", client: "Koné", lignes, acomptes: 50_000, moyen: "especes" });
    expect(estEquilibree(e)).toBe(true);
    expect(e.lignes.find((l) => l.compte === "571")).toMatchObject({ debit: 0, credit: 25_000 });
    expect(() => ecritureDepart({ numero: "X", date: "2026-10-21", client: "Koné", lignes, acomptes: 50_000, moyen: "credit", compteAuxiliaire: "411001" })).toThrow(/se rend/);
    expect(() => ecritureDepart({ numero: "X", date: "2026-10-21", client: "Koné", lignes, acomptes: 0, moyen: null })).toThrow(/moyen/);
  });

  it("laisse le solde d'une entreprise à crédit sur son compte client", () => {
    const lignes = [{ montant: 118_000, tauxTvaBp: 1800, nature: "service" as const }];
    const e = ecritureDepart({ numero: "SEJ-2026-00003", date: "2026-10-21", client: "SOTRA", lignes, acomptes: 0, moyen: "credit", compteAuxiliaire: "411007" });
    expect(e.journal).toBe("VE");
    expect(e.lignes[0]).toMatchObject({ compte: "411", auxiliaire: "411007", debit: 118_000 });
    expect(() => ecritureDepart({ numero: "X", date: "2026-10-21", client: "Passant", lignes, acomptes: 0, moyen: "credit" })).toThrow(/compte client/);
  });

  it("à l'annulation, l'acompte se rend ou devient un dédit", () => {
    const rendu = ecritureAnnulation({ numero: "SEJ-2026-00004", date: "2026-10-19", client: "Yao", acomptes: 30_000, sort: { rendre: "banque" } });
    expect(rendu.lignes.map((l) => l.compte)).toEqual(["4191", "521"]);
    const garde = ecritureAnnulation({ numero: "SEJ-2026-00004", date: "2026-10-19", client: "Yao", acomptes: 30_000, sort: "conserver" });
    expect(garde.lignes.map((l) => l.compte)).toEqual(["4191", "758"]);
    expect(totalCredit(garde)).toBe(30_000);
  });
});
