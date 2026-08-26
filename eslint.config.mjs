import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Le motif ci-dessus ne vaut qu'à la racine. Un agent qui travaille dans
    // un worktree sous .claude/ y fait naître un second .next, dont les types
    // générés par Next déclenchent une centaine d'erreurs — et le hook de
    // commit refuse alors du code parfaitement sain.
    "**/.next/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
