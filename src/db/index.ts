import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * En développement, Next recharge les modules à chaque modification. Sans ce
 * cache, chaque rechargement ouvrirait un nouveau pool et finirait par saturer
 * les connexions de PostgreSQL.
 */
const globalForDb = globalThis as unknown as {
  connection?: ReturnType<typeof postgres>;
};

const connection =
  globalForDb.connection ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 20 : 5,
    // Les horodatages circulent en UTC ; l'affichage local se fait à la vue.
    transform: { undefined: null },
  });

if (env.NODE_ENV !== "production") {
  globalForDb.connection = connection;
}

export const db = drizzle(connection, { schema });
export { schema };
