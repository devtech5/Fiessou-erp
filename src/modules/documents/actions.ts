"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { refusDroit } from "@/lib/droits/garde";
import { stockageConfigure } from "@/lib/stockage";
import { tracer } from "@/lib/audit";

import {
  creerDemandeSignatureDans,
  creerDocumentPour,
  signerDans,
  supprimerDocumentPour,
} from "./creation";
import { urlDocument } from "./requetes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Plafond de taille d'un fichier joint.
 *
 * Dix mégaoctets couvrent une photo de bon de livraison prise au téléphone et
 * un contrat scanné. Au-delà, ce n'est plus une pièce jointe — et sur une
 * connexion mobile ivoirienne, le téléversement n'aboutirait de toute façon
 * pas.
 */
const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;

/**
 * Types acceptés.
 *
 * Liste fermée, et non liste noire : accepter tout sauf quelques extensions
 * laisse toujours passer ce qu'on n'a pas prévu. Les bureautiques y figurent
 * parce qu'un client envoie son devis en .docx, qu'on le veuille ou non.
 */
const TYPES_ACCEPTES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
]);

function texte(donnees: FormData, champ: string): string | undefined {
  const valeur = donnees.get(champ);
  if (typeof valeur !== "string") return undefined;
  const propre = valeur.trim();
  return propre === "" ? undefined : propre;
}

/** Un identifiant facultatif venu d'un `select` : la valeur vide vaut « aucun ». */
function reference(donnees: FormData, champ: string): string | undefined {
  const valeur = texte(donnees, champ);
  return valeur && UUID.test(valeur) ? valeur : undefined;
}

// ------------------------------------------------------------------ documents

export interface EtatDocument {
  erreur?: string;
  message?: string;
}

const schemaDocument = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom du document."),
  categorie: z.string().trim().max(60).optional(),
  entiteType: z
    .enum([
      "tiers",
      "employe",
      "intervenant",
      "actif",
      "article",
      "vente",
      "ecriture",
      "contrat",
      "mission",
      "organisation",
    ])
    .optional(),
  entiteLibelle: z.string().trim().max(120).optional(),
  visibilite: z.enum(["prive", "restreint", "equipe"]),
  expireLe: z.string().regex(DATE_ISO).optional(),
});

export async function deposerDocument(
  _precedent: EtatDocument,
  donnees: FormData,
): Promise<EtatDocument> {
  const session = await exigerEntreprise();

  const refus = await refusDroit("documents.gerer");
  if (refus) return refus;

  const analyse = schemaDocument.safeParse({
    nom: donnees.get("nom"),
    categorie: texte(donnees, "categorie"),
    entiteType: texte(donnees, "entiteType"),
    entiteLibelle: texte(donnees, "entiteLibelle"),
    visibilite: donnees.get("visibilite") ?? "equipe",
    expireLe: texte(donnees, "expireLe"),
  });

  if (!analyse.success) return { erreur: analyse.error.issues[0].message };

  const valeurs = analyse.data;
  const entiteId = reference(donnees, "entiteId");

  if (valeurs.entiteType && !entiteId) {
    return { erreur: "Choisissez l'élément auquel rattacher ce document." };
  }

  // ------------------------------------------------------------- le fichier
  const brut = donnees.get("fichier");
  let fichier: { nom: string; typeMime: string; contenu: ArrayBuffer } | null = null;

  if (brut instanceof File && brut.size > 0) {
    if (!stockageConfigure()) {
      return {
        erreur:
          "Le dépôt de fichiers n'est pas configuré. La fiche peut être créée " +
          "sans pièce jointe, ou renseignez STOCKAGE_LOCAL.",
      };
    }
    if (brut.size > TAILLE_MAX_OCTETS) {
      return {
        erreur: `Fichier trop lourd : ${Math.round(brut.size / 1024 / 1024)} Mo pour un maximum de 10 Mo.`,
      };
    }
    if (!TYPES_ACCEPTES.has(brut.type)) {
      return {
        erreur: `Format non accepté (${brut.type || "inconnu"}). PDF, image ou document bureautique.`,
      };
    }

    fichier = {
      nom: brut.name,
      typeMime: brut.type,
      contenu: await brut.arrayBuffer(),
    };
  }

  try {
    const { avecFichier } = await creerDocumentPour(
      session.organizationId,
      {
        nom: valeurs.nom,
        categorie: valeurs.categorie ?? null,
        entiteType: valeurs.entiteType ?? null,
        entiteId: entiteId ?? null,
        entiteLibelle: valeurs.entiteLibelle ?? null,
        visibilite: valeurs.visibilite,
        expireLe: valeurs.expireLe ?? null,
        fichier,
      },
      session.userId,
    );

    revalidatePath("/documents", "layout");
    return {
      message: avecFichier
        ? `« ${valeurs.nom} » déposé.`
        : `« ${valeurs.nom} » enregistré, sans pièce jointe.`,
    };
  } catch (erreur) {
    if (erreur instanceof Error) return { erreur: erreur.message };
    throw erreur;
  }
}

export async function supprimerDocument(donnees: FormData): Promise<void> {
  const session = await exigerEntreprise();

  const refus = await refusDroit("documents.gerer");
  if (refus) return;

  const id = texte(donnees, "id");
  if (!id || !UUID.test(id)) return;

  await supprimerDocumentPour(session.organizationId, id, session.userId);
  revalidatePath("/documents", "layout");
}

/**
 * Rend une URL de lecture, valable cinq minutes.
 *
 * Signée à la demande, jamais rendue dans le HTML de la page : une URL de
 * bucket privé posée dans une page en cache resterait valable pour qui la
 * retrouve, alors que ce module existe précisément pour que les pièces
 * personnelles ne circulent pas.
 */
export async function ouvrirDocument(documentId: string): Promise<string | null> {
  const session = await exigerEntreprise();

  const refus = await refusDroit("documents.consulter");
  if (refus) return null;

  if (!UUID.test(documentId)) return null;

  return urlDocument(session.organizationId, documentId);
}

// ----------------------------------------------------------------- signatures

export interface EtatSignature {
  erreur?: string;
  reference?: string;
}

const schemaSignature = z.object({
  documentId: z.string().regex(UUID, "Choisissez le document à faire signer."),
  validiteJours: z.coerce.number().int().min(1).max(90).default(7),
  codeSecurite: z.boolean(),
  signataires: z
    .array(
      z.object({
        nom: z.string().trim().min(2),
        interne: z.boolean(),
      }),
    )
    .min(1, "Une demande sans signataire n'attend personne."),
});

export async function demanderSignature(
  _precedent: EtatSignature,
  donnees: FormData,
): Promise<EtatSignature> {
  const session = await exigerEntreprise();

  const refus = await refusDroit("documents.signature.demander");
  if (refus) return refus;

  // Les signataires arrivent en lignes parallèles : un nom par ligne, et une
  // case « interne » qui porte le RANG de sa ligne. Un formulaire n'envoie que
  // les cases COCHÉES : sans ce rang, la troisième case cochée seule
  // arriverait en première position et rendrait « interne » le mauvais nom.
  const noms = donnees.getAll("signataireNom");
  const internes = new Set(
    donnees.getAll("signataireInterne").map((valeur) => String(valeur)),
  );

  const equipe = noms
    .map((nom, index) => ({
      nom: String(nom).trim(),
      interne: internes.has(String(index)),
    }))
    .filter((signataire) => signataire.nom.length >= 2);

  const analyse = schemaSignature.safeParse({
    documentId: texte(donnees, "documentId") ?? "",
    validiteJours: texte(donnees, "validiteJours") ?? 7,
    codeSecurite: donnees.get("codeSecurite") === "on",
    signataires: equipe,
  });

  if (!analyse.success) return { erreur: analyse.error.issues[0].message };

  try {
    const { reference: numero } = await db.transaction((tx) =>
      creerDemandeSignatureDans(
        tx,
        session.organizationId,
        analyse.data,
        session.userId,
      ),
    );

    revalidatePath("/documents", "layout");
    return { reference: numero };
  } catch (erreur) {
    if (erreur instanceof Error) return { erreur: erreur.message };
    throw erreur;
  }
}

/**
 * Enregistre la signature d'un signataire interne.
 *
 * Interne SEULEMENT : un tiers extérieur signera depuis un lien reçu, ce qui
 * demande une page publique et un jeton — ce n'est pas encore construit, et
 * prétendre le contraire ferait signer quelqu'un d'autre à sa place depuis un
 * compte de l'entreprise.
 */
export async function signer(donnees: FormData): Promise<void> {
  const session = await exigerEntreprise();

  const refus = await refusDroit("documents.signature.signer");
  if (refus) return;

  const id = texte(donnees, "signataireId");
  if (!id || !UUID.test(id)) return;

  await db.transaction((tx) => signerDans(tx, session.organizationId, id));
  await tracer({ action: "signature.signer", entite: "signataire", entiteId: id });
  revalidatePath("/documents", "layout");
}
