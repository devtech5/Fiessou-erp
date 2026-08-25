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
/**
 * Un pooler en mode transaction (Supabase Supavisor sur le port 6543, PgBouncer)
 * rend une connexion au pool après chaque requête. Les requêtes préparées, qui
 * survivent à la session, ne peuvent donc pas être réutilisées : il faut les
 * désactiver, sinon la base répond « prepared statement already exists » de
 * façon intermittente, sous charge seulement.
 *
 * Le pool applicatif doit aussi rester minuscule : c'est le pooler qui
 * mutualise, pas nous. Vingt connexions par instance sans serveur épuisent le
 * quota en quelques minutes de trafic.
 */
function detecterPoolerTransaction(url: string): boolean {
  return url.includes(":6543") || /pgbouncer=true/i.test(url);
}

function resolveDb(): Database {
  if (globalForDb.fiessouDb) return globalForDb.fiessouDb;

  const derriereePooler = detecterPoolerTransaction(env.DATABASE_URL);

  const connection =
    globalForDb.fiessouConnection ??
    postgres(env.DATABASE_URL, {
      max: derriereePooler ? 1 : env.NODE_ENV === "production" ? 10 : 5,
      prepare: !derriereePooler,
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
