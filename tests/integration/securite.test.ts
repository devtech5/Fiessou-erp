import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { deciderVideo } from "@/modules/securite/autorisation";
import { cheminFlux } from "@/modules/securite/calcul";
import { creerCameraPour, creerSitePour, emettreCleRelaisPour, reglerCameraPour } from "@/modules/securite/creation";
import { signerLecture } from "@/modules/securite/jetons";
import { sitesSecurite } from "@/modules/securite/schema";

import { ouvrirBaseDeTest, semerEntreprise } from "./base";

let db: typeof Db;
let fermer: () => Promise<void>;
let org: string;
let autre: string;
let user: string;

beforeAll(async () => {
  ({ db, fermer } = await ouvrirBaseDeTest());
  ({ organizationId: org, userId: user } = await semerEntreprise(db));
  ({ organizationId: autre } = await semerEntreprise(db, "Concurrent"));
});
afterAll(async () => fermer());

describe("vidéosurveillance en base", () => {
  it("autorise le relais de son site et le lecteur muni de son jeton, rien d'autre", async () => {
    const site = await creerSitePour(org, { nom: "Entrepôt Vridi", nature: "entrepot", marque: "dahua", enregistreurAdresse: "192.168.0.50" }, user);
    await expect(creerSitePour(org, { nom: "Entrepôt Vridi", nature: "entrepot", marque: "dahua", enregistreurAdresse: "192.168.0.51" }, user)).rejects.toThrow(/existe déjà/);
    await expect(creerSitePour(org, { nom: "Piège", nature: "autre", marque: "dahua", enregistreurAdresse: "rtsp://x@y" }, user)).rejects.toThrow(/invalide/);

    const camera = await creerCameraPour(org, { siteId: site, nom: "Quai", canal: 1 }, user);
    await expect(creerCameraPour(org, { siteId: site, nom: "Doublon", canal: 1 }, user)).rejects.toThrow(/canal 1/);
    // Une autre entreprise n'ajoute pas de caméra sur ce site.
    await expect(creerCameraPour(autre, { siteId: site, nom: "Intrus", canal: 2 }, user)).rejects.toThrow(/introuvable/);

    const sd = cheminFlux(site, camera, "sd");
    const hd = cheminFlux(site, camera, "hd");

    // Sans clé émise, rien ne publie.
    expect(await deciderVideo({ action: "publish", path: sd, user: site, password: "n'importe quoi" })).toMatchObject({ autorise: false });

    const cle = await emettreCleRelaisPour(org, user, site);
    expect(await deciderVideo({ action: "publish", path: sd, user: site, password: cle })).toEqual({ autorise: true });
    const [vu] = await db.select({ vu: sitesSecurite.relaisVuLe }).from(sitesSecurite).where(eq(sitesSecurite.id, site));
    expect(vu.vu).not.toBeNull();

    // Mauvaise clé, autre site déclaré, HD non prévue : refusés.
    expect(await deciderVideo({ action: "publish", path: sd, user: site, password: `${cle}x` })).toMatchObject({ autorise: false });
    expect(await deciderVideo({ action: "publish", path: sd, user: camera, password: cle })).toMatchObject({ autorise: false });
    expect(await deciderVideo({ action: "publish", path: hd, user: site, password: cle })).toMatchObject({ autorise: false, raison: "haute définition non prévue" });
    await reglerCameraPour(org, user, camera, { hd: true });
    expect(await deciderVideo({ action: "publish", path: hd, user: site, password: cle })).toEqual({ autorise: true });

    // Une nouvelle clé coupe l'ancienne.
    const nouvelle = await emettreCleRelaisPour(org, user, site);
    expect(await deciderVideo({ action: "publish", path: sd, user: site, password: cle })).toMatchObject({ autorise: false });
    expect(await deciderVideo({ action: "publish", path: sd, user: site, password: nouvelle })).toEqual({ autorise: true });

    // Lecture : jeton de cette caméra, de cette qualité, de cette entreprise, pas expiré.
    const jeton = signerLecture({ organizationId: org, cameraId: camera, qualite: "sd", userId: user });
    expect(await deciderVideo({ action: "read", path: sd, query: `jeton=${encodeURIComponent(jeton)}` })).toEqual({ autorise: true });
    expect(await deciderVideo({ action: "read", path: sd, token: jeton })).toEqual({ autorise: true });
    expect(await deciderVideo({ action: "read", path: hd, query: `jeton=${encodeURIComponent(jeton)}` })).toMatchObject({ autorise: false });
    expect(await deciderVideo({ action: "read", path: sd })).toMatchObject({ autorise: false });
    const etranger = signerLecture({ organizationId: autre, cameraId: camera, qualite: "sd", userId: user });
    expect(await deciderVideo({ action: "read", path: sd, token: etranger })).toMatchObject({ autorise: false });
    const perime = signerLecture({ organizationId: org, cameraId: camera, qualite: "sd", userId: user }, Date.now() - 10 * 60_000);
    expect(await deciderVideo({ action: "read", path: sd, token: perime })).toMatchObject({ autorise: false });

    // Caméra retirée du mur : ni publication ni lecture.
    await reglerCameraPour(org, user, camera, { actif: false });
    expect(await deciderVideo({ action: "read", path: sd, token: jeton })).toMatchObject({ autorise: false });
    expect(await deciderVideo({ action: "publish", path: sd, user: site, password: nouvelle })).toMatchObject({ autorise: false });

    // Le reste du serveur vidéo n'est pas ouvert.
    expect(await deciderVideo({ action: "api", path: sd })).toMatchObject({ autorise: false });
    expect(await deciderVideo({ action: "read", path: "s/../../etc" })).toMatchObject({ autorise: false });
  });
});
