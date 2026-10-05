import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";

import { atteinteObjectif, calculerCommission } from "./calcul";
import { realisationsDuMois } from "./creation";
import { commerciaux, commissions } from "./schema";

export async function listerCommerciaux(organizationId: string) {
  return db
    .select()
    .from(commerciaux)
    .where(and(eq(commerciaux.organizationId, organizationId), isNull(commerciaux.deletedAt)))
    .orderBy(asc(commerciaux.nom));
}

/**
 * Le tableau du mois : pour chaque commercial, ses réalisations, la
 * commission calculée aujourd'hui et, si elle l'est, la commission validée.
 * L'écart entre les deux signale une vente enregistrée après validation.
 */
export async function tableauCommissions(organizationId: string, mois: string) {
  const [liste, realisations, validees] = await Promise.all([
    listerCommerciaux(organizationId),
    realisationsDuMois(db, organizationId, mois),
    db.select().from(commissions).where(and(eq(commissions.organizationId, organizationId), eq(commissions.mois, mois))),
  ]);
  const parCommercial = new Map(validees.map((v) => [v.commercialId, v]));
  return liste
    .filter((c) => c.actif || parCommercial.has(c.id) || realisations.has(c.id))
    .map((c) => {
      const realisation = realisations.get(c.id) ?? { caHt: 0, marge: 0 };
      const calcul = calculerCommission(realisation, { base: c.base, tauxBp: c.tauxBp, paliers: c.paliers, fixeMensuel: c.fixeMensuel });
      return {
        commercial: c,
        realisation,
        calcul,
        objectif: atteinteObjectif(realisation.caHt, c.objectifMensuel),
        validee: parCommercial.get(c.id) ?? null,
      };
    });
}

/** Commissions validées, pas encore payées : pour le tableau de bord et le plan de trésorerie. */
export async function commissionsAPayer(organizationId: string) {
  return db
    .select({ id: commissions.id, mois: commissions.mois, total: commissions.total, commercialId: commissions.commercialId })
    .from(commissions)
    .where(and(eq(commissions.organizationId, organizationId), eq(commissions.statut, "validee")));
}
