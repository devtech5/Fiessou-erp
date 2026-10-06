"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerEntreprise } from "@/lib/auth/dal";
import { refusDroit } from "@/lib/droits/garde";
import { violeContrainte } from "@/lib/erreurs-pg";

import { completerVehiculePour, creerVehiculePour, enregistrerPleinPour, retirerPleinPour } from "./creation";

export type Resultat = { ok: true; message: string; id?: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

function texte(donnees: FormData, champ: string): string | null {
  const v = donnees.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Entier saisi au clavier, espaces de milliers admis. Nul si vide. */
function entier(donnees: FormData, champ: string): number | null {
  const v = texte(donnees, champ);
  if (v === null) return null;
  const n = Number(v.replace(/[\s  ]/g, ""));
  return Number.isInteger(n) ? n : NaN;
}

function lisible(erreur: unknown): string {
  if (violeContrainte(erreur, "vehicules_immatriculation_unique")) return "Cette immatriculation est déjà au parc.";
  const message = erreur instanceof Error ? erreur.message : "";
  if (message && !message.startsWith("Failed query") && message.length < 240) return message;
  console.error("Parc auto", erreur);
  return "L'opération n'a pas abouti. Réessayez.";
}

function revalider() {
  revalidatePath("/parc-auto", "layout");
  revalidatePath("/actifs", "layout");
  revalidatePath("/");
}

const facultatif = (max: number) => z.string().max(max).nullable();
const entierBorne = (min: number, max: number, nom: string) =>
  z.number().int(`${nom} : un nombre entier.`).min(min, `${nom} hors bornes.`).max(max, `${nom} hors bornes.`).nullable();

const schemaDetails = z.object({
  immatriculation: z.string().min(4, "Indiquez l'immatriculation.").max(20),
  marque: facultatif(60),
  modele: facultatif(60),
  annee: entierBorne(1950, 2100, "Année"),
  energie: z.enum(["essence", "gasoil", "hybride", "electrique", "gpl"]).nullable(),
  numeroChassis: facultatif(40),
  numeroCarteGrise: facultatif(40),
  puissanceFiscale: entierBorne(1, 200, "Puissance fiscale"),
  places: entierBorne(1, 100, "Places"),
  couleur: facultatif(40),
  reservoirLitres: entierBorne(1, 2000, "Réservoir"),
  usage: facultatif(60),
  conducteurId: z.string().regex(UUID, "Conducteur inconnu.").nullable(),
});

function lireDetails(donnees: FormData) {
  return schemaDetails.safeParse({
    immatriculation: texte(donnees, "immatriculation") ?? "",
    marque: texte(donnees, "marque"),
    modele: texte(donnees, "modele"),
    annee: entier(donnees, "annee"),
    energie: texte(donnees, "energie"),
    numeroChassis: texte(donnees, "numeroChassis"),
    numeroCarteGrise: texte(donnees, "numeroCarteGrise"),
    puissanceFiscale: entier(donnees, "puissanceFiscale"),
    places: entier(donnees, "places"),
    couleur: texte(donnees, "couleur"),
    reservoirLitres: entier(donnees, "reservoirLitres"),
    usage: texte(donnees, "usage"),
    conducteurId: texte(donnees, "conducteurId"),
  });
}

const schemaOuverture = z.object({
  site: facultatif(80),
  dateAcquisition: z.string().regex(DATE_ISO).nullable(),
  valeurAcquisition: z.number().int().min(0, "Valeur négative.").nullable(),
  kilometrage: z.number().int().min(0, "Kilométrage négatif.").nullable(),
  assuranceLe: z.string().regex(DATE_ISO).nullable(),
  visiteLe: z.string().regex(DATE_ISO).nullable(),
  vignetteLe: z.string().regex(DATE_ISO).nullable(),
});

export async function creerVehicule(donnees: FormData): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("parc_auto.vehicule.gerer");
  if (refus) return { ok: false, message: refus.erreur };

  const details = lireDetails(donnees);
  if (!details.success) return { ok: false, message: details.error.issues[0].message };
  const ouverture = schemaOuverture.safeParse({
    site: texte(donnees, "site"),
    dateAcquisition: texte(donnees, "dateAcquisition"),
    valeurAcquisition: entier(donnees, "valeurAcquisition"),
    kilometrage: entier(donnees, "kilometrage"),
    assuranceLe: texte(donnees, "assuranceLe"),
    visiteLe: texte(donnees, "visiteLe"),
    vignetteLe: texte(donnees, "vignetteLe"),
  });
  if (!ouverture.success) return { ok: false, message: ouverture.error.issues[0].message };

  try {
    const { id, code } = await creerVehiculePour(
      session.organizationId,
      { ...details.data, ...ouverture.data, valeurAcquisition: ouverture.data.valeurAcquisition ?? 0 },
      session.userId,
    );
    revalider();
    return { ok: true, message: `${code} ouvert au parc.`, id };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

export async function modifierVehicule(actifId: string, donnees: FormData): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("parc_auto.vehicule.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(actifId)) return { ok: false, message: "Véhicule inconnu." };
  const details = lireDetails(donnees);
  if (!details.success) return { ok: false, message: details.error.issues[0].message };

  try {
    await completerVehiculePour(session.organizationId, session.userId, actifId, details.data);
    revalider();
    return { ok: true, message: "Fiche du véhicule enregistrée." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

const schemaPlein = z.object({
  actifId: z.string().regex(UUID, "Choisissez un véhicule."),
  faitLe: z.string().regex(DATE_ISO, "Date du plein invalide.").nullable(),
  volume: z.number().positive("Indiquez le volume en litres.").max(10_000, "Volume invraisemblable."),
  montant: z.number().int("Montant en francs entiers.").min(0),
  kilometrage: z.number().int().min(0).nullable(),
  complet: z.boolean(),
  station: facultatif(80),
  conducteurId: z.string().regex(UUID).nullable(),
  notes: facultatif(300),
});

export async function enregistrerPlein(donnees: FormData): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("parc_auto.carburant.saisir");
  if (refus) return { ok: false, message: refus.erreur };

  const volumeSaisi = texte(donnees, "volume");
  const analyse = schemaPlein.safeParse({
    actifId: texte(donnees, "actifId") ?? "",
    faitLe: texte(donnees, "faitLe"),
    // « 42,5 » au clavier français : la virgule est un séparateur décimal.
    volume: volumeSaisi === null ? NaN : Number(volumeSaisi.replace(/\s/g, "").replace(",", ".")),
    montant: entier(donnees, "montant") ?? NaN,
    kilometrage: entier(donnees, "kilometrage"),
    complet: donnees.get("complet") === "on",
    station: texte(donnees, "station"),
    conducteurId: texte(donnees, "conducteurId"),
    notes: texte(donnees, "notes"),
  });
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
  const v = analyse.data;

  try {
    await enregistrerPleinPour(
      session.organizationId,
      {
        actifId: v.actifId,
        // Une date nue devient midi UTC : minuit basculerait la veille dès que
        // le serveur tourne à l'ouest d'Abidjan.
        faitLe: v.faitLe ? new Date(`${v.faitLe}T12:00:00Z`) : undefined,
        volume: Math.round(v.volume * 1000),
        montant: v.montant,
        kilometrage: v.kilometrage,
        complet: v.complet,
        station: v.station,
        conducteurId: v.conducteurId,
        notes: v.notes,
      },
      session.userId,
    );
    revalider();
    return { ok: true, message: "Plein enregistré." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

export async function retirerPlein(pleinId: string): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("parc_auto.carburant.saisir");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(pleinId)) return { ok: false, message: "Plein inconnu." };
  try {
    await retirerPleinPour(session.organizationId, session.userId, pleinId);
    revalider();
    return { ok: true, message: "Plein retiré." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}
