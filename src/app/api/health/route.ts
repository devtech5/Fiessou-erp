import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Sonde de disponibilité.
 *
 * Sert aussi de garde-fou au déploiement : c'est la première route qui touche
 * réellement la base. Si la configuration ou la connexion sont mauvaises, elle
 * le dit ici plutôt que devant un caissier.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await db.execute(sql`select 1`);
    return Response.json({
      status: "ok",
      database: "ok",
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    // Le détail part dans les logs, jamais dans la réponse : le message
    // d'erreur d'une connexion contient l'hôte et l'utilisateur.
    console.error("Sonde de santé en échec", error);

    return Response.json(
      {
        status: "degraded",
        database: "injoignable",
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
