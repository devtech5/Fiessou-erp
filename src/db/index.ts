import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * En développement, Next recharge les modules à chaque modification. Sans ce
 * cache, chaque rechargement ouvrirait un pool supplémentaire et finirait par
 * saturer les connexions de PostgreSQL.
 */
const globalForDb = globalThis as unknown as {
  fiessouConnection?: ReturnType<typeof postgres>;
  fiessouDb?: Database;
};

/**
 * La connexion n'est créée qu'au premier accès, jamais au chargement du
 * module : `next build` importe ce fichier pour collecter les routes, à un
 * moment où DATABASE_URL peut ne pas être disponible.
 */
function resolveDb(): Database {
  if (globalForDb.fiessouDb) return globalForDb.fiessouDb;

  const connection =
    globalForDb.fiessouConnection ??
    postgres(env.DATABASE_URL, {
      max: env.NODE_ENV === "production" ? 20 : 5,
      transform: { undefined: null },
    });

  const instance = drizzle(connection, { schema });

  if (env.NODE_ENV !== "production") {
    globalForDb.fiessouConnection = connection;
    globalForDb.fiessouDb = instance;
  }

  return instance;
}

export const db = new Proxy({} as Database, {
  get: (_target, key: string | symbol) => {
    const value = resolveDb()[key as keyof Database];
    return typeof value === "function" ? value.bind(resolveDb()) : value;
  },
});

export { schema };
