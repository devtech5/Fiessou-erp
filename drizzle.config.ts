import { config as loadEnv } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit tourne hors du serveur Next : il faut charger .env.local nous-mêmes.
loadEnv({ path: ".env.local", quiet: true });

/**
 * Les migrations n'empruntent pas la même connexion que l'application.
 *
 * L'application passe par le pooler en mode transaction (port 6543), qui rend
 * la connexion au pool après chaque requête. drizzle-kit, lui, modifie le
 * schéma : il lui faut une session stable, donc la connexion directe ou le
 * pooler en mode session (port 5432).
 *
 * DATABASE_URL_MIGRATION prime quand elle est renseignée ; sinon on retombe
 * sur DATABASE_URL, ce qui convient pour un PostgreSQL local sans pooler.
 */
const url = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL est requis. Copiez .env.example vers .env.local et renseignez-le.",
  );
}

export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
} satisfies Config;
