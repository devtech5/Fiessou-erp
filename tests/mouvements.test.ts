import { describe, expect, it } from "vitest";

import { estEquilibree } from "@/lib/comptabilite/ecritures";
import { montantEnLettres, nombreEnLettres } from "@/lib/lettres";
import type { CompteRef } from "@/modules/tresorerie/calcul";
import { familleDuCompte } from "@/modules/tresorerie/charges";
import { ecritureMouvement, NATURES_MOUVEMENT, releveAvecSolde, type NatureMouvement } from "@/modules/tresorerie/mouvements";

const banque: CompteRef = { numero: "5211", libelle: "SGBCI Plateau", nature: "banque" };
const caisse: CompteRef = { numero: "571", libelle: "Caisse siège", nature: "caisse" };

describe("écriture d'un mouvement", () => {
  it("un versement client débite la banque et crédite le 411 du client", () => {
    const e = ecritureMouvement({ numero: "MVT-2026-00001", date: "2026-10-06", compte: banque, nature: "client", montant: 500_000, libelle: "Virement reçu", tiers: { nom: "Sotra", auxiliaire: "411C0007" } });
    expect(e.journal).toBe("BQ");
    expect(e.lignes).toEqual([
      { compte: "5211", libelleCompte: "SGBCI Plateau", debit: 500_000, credit: 0 },
      { compte: "411", libelleCompte: "Clients", auxiliaire: "411C0007", debit: 0, credit: 500_000 },
    ]);
    expect(e.libelle).toBe("Virement reçu — Sotra");
  });

  it("un paiement fournisseur débite le 401 et crédite la trésorerie", () => {
    const e = ecritureMouvement({ numero: "MVT-2026-00002", date: "2026-10-06", compte: caisse, nature: "fournisseur", montant: 75_000, libelle: "", tiers: { nom: "Koné Plomberie", auxiliaire: "401F0003" } });
    expect(e.journal).toBe("CA");
    expect(e.lignes[0]).toMatchObject({ compte: "401", auxiliaire: "401F0003", debit: 75_000 });
    expect(e.lignes[1]).toMatchObject({ compte: "571", credit: 75_000 });
    // Sans libellé saisi, celui de la nature.
    expect(e.libelle).toBe("Paiement d'un fournisseur ou prestataire — Koné Plomberie");
  });

  it("toute nature produit une écriture équilibrée, dans le bon sens", () => {
    for (const nature of Object.keys(NATURES_MOUVEMENT) as NatureMouvement[]) {
      const e = ecritureMouvement({ numero: "MVT", date: "2026-10-06", compte: banque, nature, montant: 1_234, libelle: "x", tiers: { nom: "T", auxiliaire: "AUX" } });
      expect(estEquilibree(e)).toBe(true);
      const ligneBanque = e.lignes.find((l) => l.compte === "5211")!;
      expect(NATURES_MOUVEMENT[nature].sens === "entree" ? ligneBanque.debit : ligneBanque.credit).toBe(1_234);
    }
  });

  it("exige le tiers quand la nature en demande un, et un montant entier positif", () => {
    expect(() => ecritureMouvement({ numero: "M", date: "2026-10-06", compte: banque, nature: "client", montant: 1_000, libelle: "" })).toThrow(/client/);
    expect(() => ecritureMouvement({ numero: "M", date: "2026-10-06", compte: banque, nature: "apport", montant: 0, libelle: "" })).toThrow(/Montant/);
    expect(() => ecritureMouvement({ numero: "M", date: "2026-10-06", compte: banque, nature: "apport", montant: 10.5, libelle: "" })).toThrow(/Montant/);
  });

  it("des frais bancaires saisis ici remontent dans les charges", () => {
    const e = ecritureMouvement({ numero: "M", date: "2026-10-06", compte: banque, nature: "frais_bancaires", montant: 3_500, libelle: "Agios" });
    expect(familleDuCompte(e.lignes[0].compte)).not.toBeNull();
  });
});

describe("relevé", () => {
  it("porte le solde après chaque opération", () => {
    const r = releveAvecSolde(100_000, [
      { date: "2026-10-01", piece: "A", libelle: "", origine: "mouvement", entree: 50_000, sortie: 0 },
      { date: "2026-10-02", piece: "B", libelle: "", origine: "bon_caisse", entree: 0, sortie: 170_000 },
    ]);
    expect(r.map((l) => l.solde)).toEqual([150_000, -20_000]);
  });
});

describe("montant en lettres", () => {
  it.each([
    [0, "zéro"],
    [1, "un"],
    [17, "dix-sept"],
    [21, "vingt et un"],
    [71, "soixante et onze"],
    [72, "soixante-douze"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [91, "quatre-vingt-onze"],
    [100, "cent"],
    [200, "deux cents"],
    [201, "deux cent un"],
    [1_000, "mille"],
    [2_900, "deux mille neuf cents"],
    [80_000, "quatre-vingt mille"],
    [200_000, "deux cent mille"],
    [1_000_000, "un million"],
    [2_000_000, "deux millions"],
    [200_000_000, "deux cents millions"],
    [1_250_500, "un million deux cent cinquante mille cinq cents"],
    [3_000_000_000, "trois milliards"],
  ])("%i → %s", (n, texte) => {
    expect(nombreEnLettres(n)).toBe(texte);
  });

  it("met une majuscule et la devise", () => {
    expect(montantEnLettres(150_000)).toBe("Cent cinquante mille francs CFA");
  });
});
