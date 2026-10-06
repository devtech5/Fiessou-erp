import { describe, expect, it } from "vitest";

import { normaliserAdresseEmail, normaliserDestinataire, normaliserTelephone, remplir } from "@/modules/communication/calcul";

describe("numéros de téléphone", () => {
  it("un numéro ivoirien local reçoit l'indicatif 225", () => {
    expect(normaliserTelephone("07 07 12 34 56")).toBe("2250707123456");
    expect(normaliserTelephone("0707-12-34-56")).toBe("2250707123456");
  });
  it("un numéro international garde son indicatif", () => {
    expect(normaliserTelephone("+225 07 07 12 34 56")).toBe("2250707123456");
    expect(normaliserTelephone("00221 77 123 45 67")).toBe("221771234567");
    expect(normaliserTelephone("+33 6 12 34 56 78")).toBe("33612345678");
  });
  it("l'ancien plan à huit chiffres ne se devine pas", () => {
    expect(normaliserTelephone("07 12 34 56")).toBeNull();
    expect(normaliserTelephone("abc")).toBeNull();
  });
});

describe("adresses e-mail", () => {
  it("minuscules, et refus de ce qui n'en est pas une", () => {
    expect(normaliserAdresseEmail("  Awa.Kone@Exemple.CI ")).toBe("awa.kone@exemple.ci");
    expect(normaliserAdresseEmail("awa@")).toBeNull();
    expect(normaliserDestinataire("email", "X@Y.ci")).toBe("x@y.ci");
    expect(normaliserDestinataire("whatsapp", "0707123456")).toBe("2250707123456");
  });
});

describe("gabarits", () => {
  it("remplit les variables connues, laisse visibles les autres", () => {
    expect(remplir("Bonjour {nom}, {entreprise} vous écrit. {inconnue}", { nom: "Awa", entreprise: "Quincaillerie" })).toBe(
      "Bonjour Awa, Quincaillerie vous écrit. {inconnue}",
    );
    expect(remplir("Bonjour {nom}", { nom: null })).toBe("Bonjour {nom}");
  });
});
