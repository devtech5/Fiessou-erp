import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";

import { cameras, sitesSecurite, type Camera, type SiteSecurite } from "./schema";

export interface SiteAvecCameras extends SiteSecurite {
  cameras: Camera[];
}

/** Sites et caméras de l'entreprise, dans l'ordre de leurs canaux. */
export async function sitesAvecCameras(organizationId: string, actifsSeulement = false): Promise<SiteAvecCameras[]> {
  const filtresSite = [eq(sitesSecurite.organizationId, organizationId), isNull(sitesSecurite.deletedAt)];
  if (actifsSeulement) filtresSite.push(eq(sitesSecurite.actif, true));
  const [sites, toutes] = await Promise.all([
    db.select().from(sitesSecurite).where(and(...filtresSite)).orderBy(asc(sitesSecurite.nom)),
    db
      .select()
      .from(cameras)
      .where(and(eq(cameras.organizationId, organizationId), isNull(cameras.deletedAt)))
      .orderBy(asc(cameras.ordre), asc(cameras.canal)),
  ]);
  return sites.map((site) => ({
    ...site,
    cameras: toutes.filter((c) => c.siteId === site.id && (!actifsSeulement || c.actif)),
  }));
}

export async function siteAvecCameras(organizationId: string, siteId: string): Promise<SiteAvecCameras | null> {
  return (await sitesAvecCameras(organizationId)).find((s) => s.id === siteId) ?? null;
}

/** Une caméra et son site, filtrés sur l'entreprise. */
export async function cameraDe(organizationId: string, cameraId: string) {
  const [ligne] = await db
    .select({ camera: cameras, site: sitesSecurite })
    .from(cameras)
    .innerJoin(sitesSecurite, eq(sitesSecurite.id, cameras.siteId))
    .where(and(eq(cameras.id, cameraId), eq(cameras.organizationId, organizationId), isNull(cameras.deletedAt)));
  return ligne ?? null;
}

/**
 * Site et caméra d'un chemin publié, SANS filtre d'entreprise : c'est le
 * serveur vidéo qui demande, pas une session. Le contrôle se fait ensuite sur
 * la clé du relais ou le jeton de lecture, qui portent eux l'entreprise.
 */
export async function siteEtCameraDuChemin(siteId: string, cameraId: string) {
  const [ligne] = await db
    .select({ camera: cameras, site: sitesSecurite })
    .from(cameras)
    .innerJoin(sitesSecurite, eq(sitesSecurite.id, cameras.siteId))
    .where(and(eq(cameras.id, cameraId), eq(cameras.siteId, siteId), isNull(cameras.deletedAt), isNull(sitesSecurite.deletedAt)));
  return ligne ?? null;
}
