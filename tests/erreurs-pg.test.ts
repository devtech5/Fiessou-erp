import { describe, expect, it } from "vitest";

import {
  codePostgres,
  estDoublon,
  estReferencee,
  violeContrainte,
} from "@/lib/erreurs-pg";

/**
 * Lecture des erreurs PostgreSQL à travers l'enveloppe de Drizzle.
 *
 * Testé parce que l'erreur inverse est silencieuse : un code introuvable fait
 * tomber l'utilisateur sur une page d'erreur au lieu du message prévu, et rien
 * ne le signale tant que personne ne double un code d'article.
 */

/** Forme d'une `DrizzleQueryError` : message de requête, pilote en cause. */
function enveloppe(cause: object): Error {
  return new Error("Failed query: insert into ...", { cause });
}

describe("codePostgres", () => {
  it("trouve le code sous l'enveloppe de Drizzle", () => {
    expect(codePostgres(enveloppe({ code: "23505" }))).toBe("23505");
  });

  it("trouve le code porté directement", () => {
    expect(codePostgres(Object.assign(new Error("x"), { code: "23503" }))).toBe("23503");
  });

  it("ignore un code qui n'est pas un SQLSTATE", () => {
    expect(codePostgres(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBeNull();
    expect(codePostgres(null)).toBeNull();
    expect(codePostgres("texte")).toBeNull();
  });

  it("distingue doublon et référence", () => {
    expect(estDoublon(enveloppe({ code: "23505" }))).toBe(true);
    expect(estReferencee(enveloppe({ code: "23505" }))).toBe(false);
    expect(estReferencee(enveloppe({ code: "23503" }))).toBe(true);
  });
});

describe("violeContrainte", () => {
  it("lit le nom chez postgres-js et chez PGlite", () => {
    expect(violeContrainte(enveloppe({ constraint_name: "ventes_numero_unique" }), "ventes_numero_unique")).toBe(true);
    expect(violeContrainte(enveloppe({ constraint: "ventes_numero_unique" }), "ventes_numero_unique")).toBe(true);
  });

  it("lit le nom dans le message du serveur", () => {
    const erreur = enveloppe({
      message: 'duplicate key value violates unique constraint "ecritures_piece_unique"',
    });
    expect(violeContrainte(erreur, "ecritures_piece_unique")).toBe(true);
    expect(violeContrainte(erreur, "ecritures_numero_unique")).toBe(false);
  });
});
