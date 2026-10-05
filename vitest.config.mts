import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests unitaires.
 *
 * Ce qui est couvert : le calcul. L'argent, les quantités, la numérotation, le
 * réapprovisionnement — les fonctions pures dont une régression est silencieuse
 * et fausse une déclaration de TVA ou un inventaire. Une erreur d'affichage se
 * voit ; un franc perdu par ligne, non.
 *
 * Ce qui n'est PAS couvert ici : tout ce qui touche la base. Ces chemins-là se
 * vérifient contre une vraie base PostgreSQL, avec ses contraintes et sa
 * numérotation — un test à double simulerait justement la partie qui casse.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL("./src/$1", import.meta.url)) },
      /**
       * `server-only` lève une exception hors d'un bundler React : le paquet
       * n'expose son point d'entrée inoffensif que sous la condition
       * `react-server`. Le neutraliser ici permet de tester un module qui vit
       * légitimement côté serveur, sans relâcher la garde en production.
       */
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Les tests d'intégration ont leur configuration : `pnpm test:base`.
    exclude: ["tests/integration/**", "node_modules/**"],
    environment: "node",
  },
});
