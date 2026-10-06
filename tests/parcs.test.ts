import { describe, expect, it } from "vitest";

import {
  consommation,
  coutAuKm,
  formaterConsommation,
  formaterLitres,
  normaliserImmatriculation,
  prixAuLitre,
  type PleinMesure,
} from "@/modules/parc-auto/calcul";
import { adresseIpValide, etatLicence, masquerCle, normaliserMac } from "@/modules/parc-informatique/calcul";

const plein = (jour: number, litres: number, km: number | null, complet = true, montant = 0): PleinMesure => ({
  faitLe: new Date(Date.UTC(2026, 9, jour)),
  volume: litres * 1000,
  montant,
  kilometrage: km,
  complet,
});

describe("consommation plein à plein", () => {
  it("le premier plein complet sert de repère, son volume ne compte pas", () => {
    const c = consommation([plein(1, 50, 10_000), plein(8, 40, 10_500)]);
    expect(c).toEqual({ mlPour100: 8000, distance: 500, volume: 40_000 });
    expect(formaterConsommation(c.mlPour100)).toBe("8,0 L/100 km");
  });

  it("les appoints entre deux pleins complets comptent dans le volume", () => {
    const c = consommation([plein(1, 50, 20_000), plein(4, 10, null, false), plein(9, 32, 20_600)]);
    expect(c.volume).toBe(42_000);
    expect(c.mlPour100).toBe(7000);
  });

  it("l'ordre de saisie n'importe pas, l'ordre des dates si", () => {
    const c = consommation([plein(9, 32, 20_600), plein(1, 50, 20_000), plein(4, 10, null, false)]);
    expect(c.mlPour100).toBe(7000);
  });

  it("sans deux pleins complets kilométrés, pas de mesure", () => {
    expect(consommation([plein(1, 50, 10_000)]).mlPour100).toBeNull();
    expect(consommation([plein(1, 50, 10_000), plein(5, 30, 10_400, false)]).mlPour100).toBeNull();
    expect(consommation([plein(1, 50, 10_000), plein(5, 30, null)]).mlPour100).toBeNull();
    expect(formaterConsommation(null)).toBe("—");
  });

  it("un compteur qui recule ne produit pas de consommation négative", () => {
    expect(consommation([plein(1, 50, 10_000), plein(5, 30, 9_000)]).mlPour100).toBeNull();
  });
});

describe("montants et volumes du parc auto", () => {
  it("prix au litre et coût au kilomètre restent entiers", () => {
    expect(prixAuLitre(37_125, 45_000)).toBe(825);
    expect(prixAuLitre(1000, 0)).toBe(0);
    expect(coutAuKm(400_000, 150_000, 5_000)).toBe(110);
    expect(coutAuKm(400_000, 0, 0)).toBeNull();
  });

  it("affiche les litres à la française", () => {
    expect(formaterLitres(42_500)).toBe("42,5 L");
    expect(formaterLitres(40_000)).toBe("40 L");
    expect(formaterLitres(1_234_050)).toMatch(/^1\s234,05 L$/);
  });

  it("normalise l'immatriculation", () => {
    expect(normaliserImmatriculation(" 1234 fx-01 ")).toBe("1234 FX 01");
  });
});

describe("licences logicielles", () => {
  const jour = "2026-10-06";
  it("le dépassement de postes l'emporte sur l'expiration", () => {
    expect(etatLicence({ postes: 5, utilises: 6, expireLe: "2026-01-01" }, jour).etat).toBe("depassee");
  });
  it("expirée, bientôt, conforme", () => {
    expect(etatLicence({ postes: 5, utilises: 5, expireLe: "2026-10-05" }, jour)).toEqual({ etat: "expiree", jours: -1 });
    expect(etatLicence({ postes: 5, utilises: 1, expireLe: "2026-11-05" }, jour)).toEqual({ etat: "expire_bientot", jours: 30 });
    expect(etatLicence({ postes: 5, utilises: 1, expireLe: null }, jour)).toEqual({ etat: "conforme", jours: null });
  });
});

describe("adresses réseau et clés", () => {
  it("valide une IPv4", () => {
    expect(adresseIpValide("192.168.1.20")).toBe(true);
    expect(adresseIpValide("192.168.1.256")).toBe(false);
    expect(adresseIpValide("fe80::1")).toBe(true);
    expect(adresseIpValide("pas une ip")).toBe(false);
  });
  it("normalise une adresse MAC", () => {
    expect(normaliserMac("aa-bb-cc-dd-ee-ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normaliserMac("AABB.CCDD.EEFF")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normaliserMac("AA:BB")).toBeNull();
  });
  it("masque une clé sauf ses cinq derniers caractères", () => {
    expect(masquerCle("XXXXX-YYYYY-ZZZZZ")).toBe("••••••••••••ZZZZZ");
    expect(masquerCle("ABC")).toBe("•••");
  });
});
