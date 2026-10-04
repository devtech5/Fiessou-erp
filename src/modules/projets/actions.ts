"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import type { Droit } from "@/lib/droits/catalogue";
import { refusDroit } from "@/lib/droits/garde";
import { stockageConfigure } from "@/lib/stockage";

import {
  approuverDepenseDans,
  cloreDepenseDans,
  creerProjetDans,
  demanderDepenseDans,
  joindrePiece,
  modifierProjetDans,
  payerDepenseDans,
  retirerPiece,
  type FichierJoint,
} from "./creation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

type Contexte = { organizationId: string; userId: string; estProprietaire: boolean };

async function operer(droit: Droit, travail: (ctx: Contexte) => Promise<Resultat>): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit(droit);
  if (refus) return { ok: false, message: refus.erreur };

  try {
    const resultat = await travail({
      organizationId: session.organizationId,
      userId: session.userId,
      estProprietaire: session.estProprietaire,
    });
    if (resultat.ok) {
      revalidatePath("/projets", "layout");
      revalidatePath("/comptabilite", "layout");
      revalidatePath("/");
    }
    return resultat;
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 240;
    if (!lisible) console.error("Projets : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

const texte = (donnees: FormData, champ: string) => {
  const v = donnees.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};
const montant = (v: string | undefined) => (v === undefined ? null : Number(v.replace(/[\s  ]/g, "")));
const id = (donnees: FormData, champ: string) => {
  const v = texte(donnees, champ);
  return v && UUID.test(v) ? v : null;
};

/** Plafond d'une pièce jointe : une photo de téléphone, un reçu scanné. */
const TAILLE_MAX = 10 * 1024 * 1024;
const TYPES_ACCEPTES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);

async function lireFichier(donnees: FormData): Promise<FichierJoint | null | string> {
  const brut = donnees.get("fichier");
  if (!(brut instanceof File) || brut.size === 0) return null;
  if (!stockageConfigure()) return "Le dépôt de fichiers n'est pas configuré : la pièce ne peut pas être enregistrée.";
  if (brut.size > TAILLE_MAX) return `Fichier trop lourd : ${Math.ceil(brut.size / 1024 / 1024)} Mo pour 10 Mo au plus.`;
  if (!TYPES_ACCEPTES.has(brut.type)) return `Format non accepté (${brut.type || "inconnu"}) : photo ou PDF.`;
  return { nom: brut.name, typeMime: brut.type, contenu: await brut.arrayBuffer() };
}

// ------------------------------------------------------------------ projets

const schemaProjet = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom du projet."),
  description: z.string().max(1000).optional(),
  budget: z.number().int().min(0).nullable(),
  debut: z.string().regex(DATE_ISO).optional(),
  fin: z.string().regex(DATE_ISO).optional(),
});

export async function creerProjet(donnees: FormData): Promise<Resultat> {
  return operer("projet.gerer", async ({ organizationId, userId }) => {
    const analyse = schemaProjet.safeParse({
      nom: donnees.get("nom"),
      description: texte(donnees, "description"),
      budget: montant(texte(donnees, "budget")),
      debut: texte(donnees, "debut"),
      fin: texte(donnees, "fin"),
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    const { code } = await db.transaction((tx) =>
      creerProjetDans(
        tx,
        organizationId,
        { ...analyse.data, responsableUserId: id(donnees, "responsableUserId"), clientId: id(donnees, "clientId") },
        userId,
      ),
    );
    return { ok: true, message: `Projet ${code} créé.` };
  });
}

const schemaModification = z.object({
  responsableUserId: z.string().regex(UUID).nullable().optional(),
  statut: z.enum(["preparation", "en_cours", "suspendu", "termine", "annule"]).optional(),
  budget: z.number().int().min(0).nullable().optional(),
  fin: z.string().regex(DATE_ISO).nullable().optional(),
});

export async function modifierProjet(projetId: string, modification: unknown): Promise<Resultat> {
  return operer("projet.gerer", async ({ organizationId, userId }) => {
    const analyse = schemaModification.safeParse(modification);
    if (!UUID.test(projetId) || !analyse.success) return { ok: false, message: "Modification invalide." };
    const { code } = await db.transaction((tx) => modifierProjetDans(tx, organizationId, projetId, analyse.data, userId));
    return { ok: true, message: `${code} mis à jour.` };
  });
}

// ----------------------------------------------------------------- dépenses

const schemaDepense = z.object({
  objet: z.string().trim().min(3, "Décrivez l'achat : quoi, pour quoi."),
  categorie: z.string().min(1),
  montant: z.number({ error: "Indiquez le montant." }).int().positive("Le montant doit être positif."),
  tauxTva: z.number().int().min(0).max(5000),
  fournisseurLibelle: z.string().max(120).optional(),
});

/**
 * Demande de dépense, avec en option la facture ou le devis du fournisseur.
 */
export async function demanderDepense(donnees: FormData): Promise<Resultat> {
  return operer("depense.demander", async ({ organizationId, userId }) => {
    const analyse = schemaDepense.safeParse({
      objet: donnees.get("objet"),
      categorie: donnees.get("categorie"),
      montant: montant(texte(donnees, "montant")) ?? undefined,
      tauxTva: donnees.get("avecTva") === "on" ? 1800 : 0,
      fournisseurLibelle: texte(donnees, "fournisseurLibelle"),
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    const fichier = await lireFichier(donnees);
    if (typeof fichier === "string") return { ok: false, message: fichier };

    const { id: depenseId, numero } = await db.transaction((tx) =>
      demanderDepenseDans(
        tx,
        organizationId,
        { ...analyse.data, projetId: id(donnees, "projetId"), fournisseurId: id(donnees, "fournisseurId") },
        userId,
      ),
    );
    if (fichier) await joindrePiece(organizationId, { depenseId }, { nature: "facture", fichier }, userId);
    return { ok: true, message: `Demande ${numero} enregistrée${fichier ? ", devis joint" : ""} — en attente d'approbation.` };
  });
}

export async function approuverDepense(depenseId: string, accepterDepassement = false): Promise<Resultat> {
  return operer("depense.approuver", async ({ organizationId, userId, estProprietaire }) => {
    if (!UUID.test(depenseId)) return { ok: false, message: "Dépense introuvable." };
    const { numero } = await db.transaction((tx) =>
      approuverDepenseDans(tx, organizationId, depenseId, { userId, estProprietaire }, accepterDepassement),
    );
    return { ok: true, message: `${numero} approuvée.` };
  });
}

export async function refuserDepense(depenseId: string, vers: string, motif: string): Promise<Resultat> {
  const cible = vers === "rejetee" ? "rejetee" : "annulee";
  return operer(cible === "rejetee" ? "depense.approuver" : "depense.demander", async ({ organizationId, userId }) => {
    if (!UUID.test(depenseId) || motif.trim().length < 3) return { ok: false, message: "Indiquez le motif." };
    const { numero } = await db.transaction((tx) => cloreDepenseDans(tx, organizationId, depenseId, cible, motif.trim(), userId));
    return { ok: true, message: `${numero} ${cible === "rejetee" ? "rejetée" : "annulée"}.` };
  });
}

/** Paiement, avec la preuve (reçu, capture du transfert) jointe dans le même geste. */
export async function payerDepense(donnees: FormData): Promise<Resultat> {
  return operer("depense.payer", async ({ organizationId, userId }) => {
    const depenseId = id(donnees, "depenseId");
    const moyen = z.enum(["especes", "mobile_money", "banque"]).safeParse(donnees.get("moyen"));
    if (!depenseId || !moyen.success) return { ok: false, message: "Choisissez le moyen de paiement." };
    const fichier = await lireFichier(donnees);
    if (typeof fichier === "string") return { ok: false, message: fichier };

    const { numero, ecriture } = await db.transaction((tx) =>
      payerDepenseDans(tx, organizationId, depenseId, { moyen: moyen.data, reference: texte(donnees, "reference") }, userId),
    );
    if (fichier) await joindrePiece(organizationId, { depenseId }, { nature: "preuve_paiement", fichier }, userId);
    return {
      ok: true,
      message: `${numero} payée (écriture ${ecriture})${fichier ? ", preuve jointe" : " — pensez à joindre la preuve de paiement"}.`,
    };
  });
}

// ------------------------------------------------------------------ pièces

/**
 * Ajoute une photo ou une preuve à un projet ou à une dépense. Joindre la
 * preuve d'une dépense est ouvert à tout le circuit ; enrichir un projet
 * revient à qui le gère.
 */
export async function ajouterPiece(donnees: FormData): Promise<Resultat> {
  return operer(id(donnees, "depenseId") ? "depense.demander" : "projet.gerer", async ({ organizationId, userId }) => {
    const nature = z.enum(["photo", "preuve_paiement", "facture", "autre"]).safeParse(donnees.get("nature"));
    if (!nature.success) return { ok: false, message: "Choisissez la nature de la pièce." };
    const fichier = await lireFichier(donnees);
    if (fichier === null) return { ok: false, message: "Choisissez un fichier." };
    if (typeof fichier === "string") return { ok: false, message: fichier };

    await joindrePiece(
      organizationId,
      { projetId: id(donnees, "projetId"), depenseId: id(donnees, "depenseId") },
      { nature: nature.data, legende: texte(donnees, "legende"), fichier },
      userId,
    );
    return { ok: true, message: nature.data === "photo" ? "Photo ajoutée." : "Pièce ajoutée." };
  });
}

export async function supprimerPiece(pieceId: string): Promise<Resultat> {
  return operer("projet.gerer", async ({ organizationId, userId }) => {
    if (!UUID.test(pieceId)) return { ok: false, message: "Pièce introuvable." };
    await retirerPiece(organizationId, pieceId, userId);
    return { ok: true, message: "Pièce retirée." };
  });
}
