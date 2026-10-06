import { describe, expect, it } from "vitest";

import { chiffrer, dechiffrer } from "@/lib/chiffrement";

describe("chiffrement des secrets relus", () => {
  it("rend le texte d'origine, jamais deux fois le même chiffré", () => {
    const a = chiffrer("abcd efgh ijkl mnop", "boite-mail");
    const b = chiffrer("abcd efgh ijkl mnop", "boite-mail");
    expect(a).not.toBe(b);
    expect(a).not.toContain("abcd");
    expect(dechiffrer(a, "boite-mail")).toBe("abcd efgh ijkl mnop");
  });

  it("refuse un chiffré altéré ou relu pour un autre usage", () => {
    const scelle = chiffrer("secret", "boite-mail");
    const [v, iv, tag, donnees] = scelle.split(".");
    const altere = [v, iv, tag, `${donnees.slice(0, -2)}AA`].join(".");
    expect(() => dechiffrer(altere, "boite-mail")).toThrow();
    expect(() => dechiffrer(scelle, "autre-usage")).toThrow();
    expect(() => dechiffrer("n'importe quoi", "boite-mail")).toThrow();
  });
});
