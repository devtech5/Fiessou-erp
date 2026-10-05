import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests d'intégration : contre un VRAI PostgreSQL — PGlite en mémoire, toutes
 * migrations appliquées. Contraintes, transactions, numérotation et verrous
 * comptables y sont les vrais ; seul le moteur change de forme.
 *
 * Configuration séparée et non fusionnée : `mergeConfig` concatène les listes
 * `exclude`, et celle des tests unitaires écarte justement ce dossier.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL("./src/$1", import.meta.url)) },
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) },
    ],
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 180_000,
    env: {
      DATABASE_URL: "pglite:memoire",
      AUTH_SECRET: "integration-integration-integration-0123456789",
    },
  },
});
