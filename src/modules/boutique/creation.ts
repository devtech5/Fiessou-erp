import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { newId } from "@/lib/ids";
import { creerFamilleDans } from "@/modules/catalogue/creation";
import { famillesArticle } from "@/modules/catalogue/schema";

import { FAMILLES_COMMERCE } from "./calcul";

/**
 * Installe les familles d'un commerce de détail.
 *
 * Rejouable : une famille dont le code existe déjà est laissée telle quelle,
 * avec les réglages que le commerçant lui a peut-être donnés depuis.
 */
export async function installerCatalogueDepartPour(organizationId: string, userId: string): Promise<{ creees: number }> {
  return db.transaction(async (tx) => {
    const existantes = await tx
      .select({ code: famillesArticle.code })
      .from(famillesArticle)
      .where(
        and(
          eq(famillesArticle.organizationId, organizationId),
          inArray(
            famillesArticle.code,
            FAMILLES_COMMERCE.map((f) => f.code),
          ),
        ),
      );
    const deja = new Set(existantes.map((f) => f.code));

    let creees = 0;
    for (const [ordre, famille] of FAMILLES_COMMERCE.entries()) {
      if (deja.has(famille.code)) continue;
      await creerFamilleDans(tx, organizationId, { code: famille.code, nom: famille.nom, tauxTva: 1800, ordre });
      creees++;
    }

    if (creees > 0) {
      await tx.insert(auditLogs).values({
        id: newId(),
        organizationId,
        userId,
        action: "catalogue.installer",
        entityType: "famille_article",
        after: { familles: creees },
      });
    }
    return { creees };
  });
}
