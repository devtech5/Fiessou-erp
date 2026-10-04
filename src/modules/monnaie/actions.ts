"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import type { Droit } from "@/lib/droits/catalogue";
import { refusDroit } from "@/lib/droits/garde";
import { estDoublon } from "@/lib/erreurs-pg";
import { tracer } from "@/lib/audit";

import { annulerOperationDans, cloturerSessionDans, enregistrerOperationDans, ouvrirSessionDans } from "./creation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

async function operer(
  droit: Droit,
  travail: (organizationId: string, userId: string) => Promise<Resultat>,
): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit(droit);
  if (refus) return { ok: false, message: refus.erreur };

  try {
    const resultat = await travail(session.organizationId, session.userId);
    if (resultat.ok) {
      revalidatePath("/monnaie", "layout");
      revalidatePath("/comptabilite", "layout");
      revalidatePath("/");
    }
    return resultat;
  } catch (erreur) {
    if (estDoublon(erreur)) return { ok: false, message: "Le guichet est déjà ouvert." };
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 200;
    if (!lisible) console.error("Guichet : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

const montant = z.number().int().min(0);
const RESEAU = z.enum(["wave", "orange", "mtn", "moov"]);

const schemaOuverture = z.object({
  fondCaisse: montant,
  floats: z.partialRecord(RESEAU, montant),
});

export async function ouvrirGuichet(ouverture: unknown): Promise<Resultat> {
  return operer("valeur_electronique.operation.saisir", async (organizationId, userId) => {
    const analyse = schemaOuverture.safeParse(ouverture);
    if (!analyse.success) return { ok: false, message: "Montants d'ouverture invalides." };
    const { numero } = await db.transaction((tx) => ouvrirSessionDans(tx, organizationId, analyse.data, userId));
    return { ok: true, message: `Guichet ouvert (${numero}).` };
  });
}

const schemaOperation = z.object({
  type: z.enum(["depot", "retrait", "credit", "approvisionnement", "destockage"]),
  reseau: RESEAU,
  montant: z.number().int().positive("Indiquez le montant."),
  commission: montant,
  telephone: z.string().trim().max(30).optional(),
  referenceOperateur: z.string().trim().max(60).optional(),
});

export async function enregistrerOperation(operation: unknown): Promise<Resultat> {
  return operer("valeur_electronique.operation.saisir", async (organizationId, userId) => {
    const analyse = schemaOperation.safeParse(operation);
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    const { numero } = await db.transaction((tx) => enregistrerOperationDans(tx, organizationId, analyse.data, userId));
    await tracer({
      action: "guichet.operation",
      entite: "operation_guichet",
      apres: { numero, type: analyse.data.type, reseau: analyse.data.reseau, montant: analyse.data.montant },
    });
    return { ok: true, message: `Opération ${numero} enregistrée.` };
  });
}

export async function annulerOperation(operationId: string, motif: string): Promise<Resultat> {
  return operer("valeur_electronique.operation.annuler", async (organizationId, userId) => {
    if (!UUID.test(operationId) || motif.trim().length < 3) return { ok: false, message: "Indiquez le motif de l'annulation." };
    const { numero } = await db.transaction((tx) => annulerOperationDans(tx, organizationId, operationId, motif.trim(), userId));
    return { ok: true, message: `${numero} annulée.` };
  });
}

const schemaCloture = z.object({
  especesComptees: montant,
  releves: z.partialRecord(RESEAU, montant.nullable()),
  observations: z.string().trim().max(300).optional(),
});

export async function cloturerGuichet(cloture: unknown): Promise<Resultat> {
  return operer("valeur_electronique.session.cloturer", async (organizationId, userId) => {
    const analyse = schemaCloture.safeParse(cloture);
    if (!analyse.success) return { ok: false, message: "Saisissez les espèces comptées." };
    const { numero, ecartEspeces, ecriture } = await db.transaction((tx) =>
      cloturerSessionDans(tx, organizationId, analyse.data, userId),
    );
    const ecart =
      ecartEspeces === 0
        ? "caisse juste"
        : ecartEspeces < 0
          ? `manquant de ${(-ecartEspeces).toLocaleString("fr-FR")} F`
          : `excédent de ${ecartEspeces.toLocaleString("fr-FR")} F`;
    return { ok: true, message: `${numero} clôturé — ${ecart}${ecriture ? ` (écriture ${ecriture})` : ""}.` };
  });
}
