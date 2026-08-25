import { config as loadEnv } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit tourne hors du serveur Next : il faut charger .env.local nous-mêmes.
loadEnv({ path: ".env.local", quiet: true });

export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
