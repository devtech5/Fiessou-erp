import { describe, expect, it } from "vitest";

import { formerJetonReinit, lireJetonReinit } from "@/lib/auth/identifiants";

describe("jeton de réinitialisation", () => {
  const id = "01a10848-a51e-70e1-a7b8-f4028b5413bd";
  const secret = "Qx3_kZ-9".repeat(5);

  it("se lit comme il a été formé", () => {
    expect(lireJetonReinit(formerJetonReinit(id, secret))).toEqual({ id, secret });
  });

  it("refuse un jeton tronqué, sans identifiant ou au secret trop court", () => {
    expect(lireJetonReinit(id)).toBeNull();
    expect(lireJetonReinit(`pas-un-uuid.${secret}`)).toBeNull();
    expect(lireJetonReinit(`${id}.court`)).toBeNull();
    expect(lireJetonReinit(`${id}.${secret}/../x`)).toBeNull();
  });
});
