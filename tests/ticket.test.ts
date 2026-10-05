import { describe, expect, it } from "vitest";

import { totaliser } from "@/lib/caisse/panier";
import {
  COLONNES,
  composerTicket,
  couper,
  type DonneesTicket,
} from "@/lib/caisse/ticket";

const lignes = [
  { designation: "Riz parfumé sac 25 kg", quantite: 2000, prixUnitaire: 15000, remise: 0, unite: "piece" as const },
  { designation: "Huile", quantite: 1500, prixUnitaire: 1200, remise: 300, unite: "l" as const },
];

function donnees(): DonneesTicket {
  const panier = lignes.map((x, i) => ({ id: String(i), articleId: "a", ...x }));
  return {
    boutique: "Quincaillerie Akwaba",
    poste: "Caisse 1",
    caissier: "Awa",
    numero: "C01-000042",
    encaisseeLe: "2026-08-26T14:05:00.000Z",
    lignes,
    totaux: totaliser(panier),
    reglements: [{ libelle: "Espèces", montant: 31500 }],
    especesRecues: 35000,
  };
}

describe("composerTicket", () => {
  it.each([58, 80] as const)("ne dépasse jamais la largeur (%i mm)", (largeur) => {
    for (const ligne of composerTicket(donnees(), largeur)) {
      expect(ligne.length).toBeLessThanOrEqual(COLONNES[largeur]);
    }
  });

  it("porte le total, la remise, le net et le numéro", () => {
    const texte = composerTicket(donnees(), 80).join("\n");
    expect(texte).toContain("TOTAL A PAYER");
    expect(texte).toContain("REMISE");
    expect(texte).toContain("C01-000042");
    expect(texte).toContain("26/08/2026 14:05");
  });

  it("rend la monnaie sur la part espèces seulement", () => {
    const texte = composerTicket(donnees(), 80).join("\n").replace(/\s/g, "");
    expect(texte).toContain("Monnaierendue3500");
  });
});

describe("couper", () => {
  it("coupe sans dépasser et sans perdre de caractère", () => {
    const entree = "Ampoule LED économique 12 W culot E27 blanc chaud";
    const parts = couper(entree, 20);
    parts.forEach((p) => expect(p.length).toBeLessThanOrEqual(20));
    expect(parts.join(" ")).toBe(entree);
  });

  it("tranche un mot plus long que la ligne", () => {
    expect(couper("ABCDEFGHIJ", 4)).toEqual(["ABCD", "EFGH", "IJ"]);
  });
});

describe("identité de l'entreprise sur le ticket", () => {
  const avecIdentite = (): DonneesTicket => ({
    ...donnees(),
    entete: ["Rue des Jardins, Abidjan Cocody", "Tél. +225 07 00 00 00 00", "NCC 1234567A"],
    piedDePage: "Marchandise vendue ni reprise ni échangée après 48 heures sans le ticket de caisse.\nOrange Money : 07 00 00 00 00",
  });

  it.each([58, 80] as const)("en-tête et pied tiennent dans la largeur (%i mm)", (largeur) => {
    const sortie = composerTicket(avecIdentite(), largeur);
    for (const ligne of sortie) expect(ligne.length).toBeLessThanOrEqual(COLONNES[largeur]);
    const texte = sortie.join("\n");
    expect(texte).toContain("NCC 1234567A");
    expect(texte).toContain("Orange Money");
    // Le pied précède le remerciement, l'en-tête suit le nom.
    expect(texte.indexOf("Orange Money")).toBeLessThan(texte.indexOf("Merci de votre visite"));
    expect(texte.indexOf("NCC")).toBeLessThan(texte.indexOf("Caisse 1"));
  });
});
