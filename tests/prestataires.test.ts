import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import { compteParDefaut, ecriturePrestation, formaterNote, noteMoyenne, retenue, transitionPermise } from "@/modules/prestataires/calcul";

describe("prestataires — règles", () => {
  it("propose un compte de charge d'après le métier", () => {
    expect(compteParDefaut("Plombier")).toBe("624");
    expect(compteParDefaut("Monteur vidéo")).toBe("627");
    expect(compteParDefaut("Consultant")).toBe("6324");
    expect(compteParDefaut("Transporteur")).toBe("618");
    expect(compteParDefaut("Jardinier")).toBe("621");
  });

  it("note moyenne en dixièmes, sans flottant", () => {
    expect(noteMoyenne([5, 4, 4])).toBe(43);
    expect(noteMoyenne([null, 3])).toBe(30);
    expect(noteMoyenne([])).toBeNull();
    expect(formaterNote(43)).toBe("4,3 / 5");
  });

  it("une prestation suit son ordre : on ne paie pas avant d'avoir constaté", () => {
    expect(transitionPermise("demandee", "payee")).toBe(false);
    expect(transitionPermise("realisee", "payee")).toBe(true);
    expect(transitionPermise("payee", "annulee")).toBe(false);
    expect(transitionPermise("demandee", "realisee")).toBe(true);
  });

  it("écriture de paiement équilibrée, retenue au 447", () => {
    expect(retenue(100_000, 750)).toBe(7_500);
    const e = ecriturePrestation({
      numero: "PRE-2026-00001",
      date: "2026-10-06",
      objet: "Réparation fuite",
      prestataire: "Koné Plomberie",
      montant: 100_000,
      retenue: 7_500,
      compteCharge: "624",
      tresorerie: { numero: "5711", libelle: "Caisse", journal: "CA" },
    });
    expect(estEquilibree(e)).toBe(true);
    expect(e.lignes).toEqual([
      expect.objectContaining({ compte: "624", debit: 100_000 }),
      expect.objectContaining({ compte: "5711", credit: 92_500 }),
      expect.objectContaining({ compte: "447", credit: 7_500 }),
    ]);
    expect(() => ecriturePrestation({ ...{ numero: "x", date: "2026-10-06", objet: "x", prestataire: "x", compteCharge: "624" as const, tresorerie: { numero: "5711", libelle: "C", journal: "CA" as const } }, montant: 1000, retenue: 1000 })).toThrow();
  });
});
