import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Un seul pool de connexions par processus, en production comme en
 * développement.
 *
 * Testé parce que la panne est invisible en développement : le cache n'y était
 * posé que hors production, et chaque accès à `db` ouvrait en production un
 * pool neuf. PostgreSQL finissait par refuser (« too many clients already »)
 * et tout l'écran de gestion tombait. Aucune connexion n'est ouverte ici :
 * postgres-js ne se connecte qu'à la première requête.
 */
const globalForDb = globalThis as { fiessouConnection?: unknown; fiessouDb?: unknown };

afterEach(() => {
  delete globalForDb.fiessouConnection;
  delete globalForDb.fiessouDb;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("db", () => {
  it("garde le même pool d'un accès à l'autre en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://fiessou@127.0.0.1:1/fiessou");
    vi.stubEnv("AUTH_SECRET", "test-test-test-test-test-test-test-test");
    delete globalForDb.fiessouConnection;
    delete globalForDb.fiessouDb;

    const { db } = await import("@/db");
    void db.select;
    const premier = globalForDb.fiessouConnection;
    void db.transaction;

    expect(premier).toBeDefined();
    expect(globalForDb.fiessouConnection).toBe(premier);
  });
});
