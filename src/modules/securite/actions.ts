"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/env";
import { exigerEntreprise } from "@/lib/auth/dal";
import { refusDroit } from "@/lib/droits/garde";

import { cheminFlux, configurationRelais } from "./calcul";
import { creerCameraPour, creerSitePour, emettreCleRelaisPour, reglerCameraPour, tracerVisionnage } from "./creation";
import { signerLecture } from "./jetons";
import { cameraDe, siteAvecCameras } from "./requetes";

export type Resultat = { ok: true; message: string; id?: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texte(donnees: FormData, champ: string): string | null {
  const v = donnees.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function lisible(erreur: unknown): string {
  const message = erreur instanceof Error ? erreur.message : "";
  if (message && !message.startsWith("Failed query") && message.length < 240) return message;
  console.error("Sécurité", erreur);
  return "L'opération n'a pas abouti. Réessayez.";
}

function revalider() {
  revalidatePath("/securite", "layout");
}

const schemaSite = z.object({
  nom: z.string().min(2, "Donnez un nom au site.").max(80),
  nature: z.enum(["magasin", "entrepot", "bureau", "autre"]),
  adresse: z.string().max(200).nullable(),
  marque: z.enum(["hikvision", "dahua"]),
  enregistreurAdresse: z.string().min(3, "Indiquez l'adresse de l'enregistreur sur le réseau du site.").max(253),
  enregistreurPort: z.number().int().min(1).max(65535),
});

export async function creerSite(donnees: FormData): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("securite.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  const port = texte(donnees, "enregistreurPort");
  const analyse = schemaSite.safeParse({
    nom: texte(donnees, "nom") ?? "",
    nature: texte(donnees, "nature") ?? "magasin",
    adresse: texte(donnees, "adresse"),
    marque: texte(donnees, "marque") ?? "hikvision",
    enregistreurAdresse: texte(donnees, "enregistreurAdresse") ?? "",
    enregistreurPort: port ? Number(port) : 554,
  });
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
  try {
    const id = await creerSitePour(session.organizationId, analyse.data, session.userId);
    revalider();
    return { ok: true, message: `Site « ${analyse.data.nom} » ajouté.`, id };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

const schemaCamera = z.object({
  nom: z.string().min(2, "Donnez un nom à la caméra.").max(80),
  emplacement: z.string().max(120).nullable(),
  canal: z.number().int("Canal : un nombre entier.").min(1, "Canal : de 1 à 256.").max(256, "Canal : de 1 à 256."),
  hd: z.boolean(),
});

export async function creerCamera(siteId: string, donnees: FormData): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("securite.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(siteId)) return { ok: false, message: "Site inconnu." };
  const analyse = schemaCamera.safeParse({
    nom: texte(donnees, "nom") ?? "",
    emplacement: texte(donnees, "emplacement"),
    canal: Number(texte(donnees, "canal") ?? NaN),
    hd: donnees.get("hd") === "on",
  });
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
  try {
    await creerCameraPour(session.organizationId, { siteId, ...analyse.data }, session.userId);
    revalider();
    return { ok: true, message: `Caméra « ${analyse.data.nom} » ajoutée. Remettez à jour la configuration du relais.` };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

export async function reglerCamera(cameraId: string, reglage: { actif?: boolean; hd?: boolean }): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("securite.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(cameraId)) return { ok: false, message: "Caméra inconnue." };
  const propre = {
    ...(typeof reglage.actif === "boolean" ? { actif: reglage.actif } : {}),
    ...(typeof reglage.hd === "boolean" ? { hd: reglage.hd } : {}),
  };
  try {
    await reglerCameraPour(session.organizationId, session.userId, cameraId, propre);
    revalider();
    return { ok: true, message: "Caméra réglée." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

/** Nouvelle clé du relais d'un site, montrée une seule fois. L'ancienne cesse de publier. */
export async function emettreCleRelais(siteId: string): Promise<Resultat & { cle?: string }> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("securite.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(siteId)) return { ok: false, message: "Site inconnu." };
  try {
    const cle = await emettreCleRelaisPour(session.organizationId, session.userId, siteId);
    revalider();
    return { ok: true, message: "Clé émise. Copiez-la maintenant : elle ne sera plus affichée.", cle };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

/** Configuration go2rtc du relais d'un site. Sans aucun secret : elle peut circuler. */
export async function configurationDuRelais(siteId: string): Promise<Resultat & { contenu?: string }> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("securite.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(siteId)) return { ok: false, message: "Site inconnu." };
  if (!env.VIDEO_PUBLICATION) return { ok: false, message: "Le serveur vidéo n'est pas configuré (VIDEO_PUBLICATION)." };
  const site = await siteAvecCameras(session.organizationId, siteId);
  if (!site) return { ok: false, message: "Site inconnu." };
  const actives = site.cameras.filter((c) => c.actif);
  if (actives.length === 0) return { ok: false, message: "Ajoutez au moins une caméra avant de configurer le relais." };
  return {
    ok: true,
    message: "Configuration prête.",
    contenu: configurationRelais({
      id: site.id,
      nom: site.nom,
      marque: site.marque,
      adresse: site.enregistreurAdresse,
      port: site.enregistreurPort,
      publication: env.VIDEO_PUBLICATION,
      cameras: actives.map((c) => ({ id: c.id, nom: c.nom, canal: c.canal, hd: c.hd })),
    }),
  };
}

/**
 * Ouvre une caméra : vérifie le droit, trace le visionnage, et rend l'adresse
 * WHEP avec un jeton de lecture valable deux minutes.
 */
export async function ouvrirCamera(cameraId: string, qualite: "hd" | "sd"): Promise<Resultat & { url?: string }> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("securite.visionner");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(cameraId) || (qualite !== "hd" && qualite !== "sd")) return { ok: false, message: "Caméra inconnue." };
  if (!env.VIDEO_URL_PUBLIQUE) return { ok: false, message: "Serveur vidéo non configuré." };

  const ligne = await cameraDe(session.organizationId, cameraId);
  if (!ligne || !ligne.camera.actif || !ligne.site.actif) return { ok: false, message: "Caméra indisponible." };
  const q = qualite === "hd" && ligne.camera.hd ? "hd" : "sd";

  await tracerVisionnage(session.organizationId, session.userId, cameraId, ligne.camera.nom, q);
  const jeton = signerLecture({ organizationId: session.organizationId, cameraId, qualite: q, userId: session.userId });
  const base = env.VIDEO_URL_PUBLIQUE.replace(/\/$/, "");
  return { ok: true, message: "", url: `${base}/${cheminFlux(ligne.site.id, cameraId, q)}/whep?jeton=${encodeURIComponent(jeton)}` };
}
