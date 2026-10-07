"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { refusDroit } from "@/lib/droits/garde";

import { annulerMouvementDans, enregistrerMouvementDans } from "./creation-mouvements";
import { NATURES_MOUVEMENT, type NatureMouvement } from "./mouvements";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

async function operer(travail: (ctx: { organizationId: string; userId: string }) => Promise<Resultat>): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("tresorerie.mouvement.saisir");
  if (refus) return { ok: false, message: refus.erreur };
  try {
    const r = await travail({ organizationId: session.organizationId, userId: session.userId });
    if (r.ok) {
      revalidatePath("/tresorerie", "layout");
      revalidatePath("/comptabilite", "layout");
      revalidatePath("/");
    }
    return r;
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 240;
    if (!lisible) console.error("Mouvements : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

const texte = (d: FormData, champ: string) => {
  const v = d.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};
const montant = (v: string | undefined) => {
  if (v === undefined) return undefined;
  const propre = v.replace(/[\s  ]/g, "");
  return /^\d+$/.test(propre) ? Number(propre) : Number.NaN;
};

const NATURES = Object.keys(NATURES_MOUVEMENT) as [NatureMouvement, ...NatureMouvement[]];

const schemaMouvement = z.object({
  compteId: z.string({ error: "Choisissez le compte." }).regex(UUID, "Choisissez le compte."),
  nature: z.enum(NATURES, { error: "Choisissez la nature du mouvement." }),
  montant: z.number({ error: "Indiquez le montant." }).int("Montant en francs entiers.").positive("Le montant doit être positif."),
  date: z.string({ error: "Indiquez la date." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez la date."),
  libelle: z.string().trim().max(200).optional(),
  tiersId: z.string().regex(UUID).optional(),
  reference: z.string().trim().max(80).optional(),
  ribBeneficiaire: z.string().trim().max(80).optional(),
});

export async function enregistrerMouvement(donnees: FormData): Promise<Resultat> {
  return operer(async ({ organizationId, userId }) => {
    const analyse = schemaMouvement.safeParse({
      compteId: texte(donnees, "compteId"),
      nature: texte(donnees, "nature"),
      montant: montant(texte(donnees, "montant")),
      date: texte(donnees, "date"),
      libelle: texte(donnees, "libelle"),
      tiersId: texte(donnees, "tiersId"),
      reference: texte(donnees, "reference"),
      ribBeneficiaire: texte(donnees, "ribBeneficiaire"),
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    const { numero, ecriture } = await db.transaction((tx) => enregistrerMouvementDans(tx, organizationId, analyse.data, userId));
    return { ok: true, message: `Mouvement ${numero} enregistré — écriture ${ecriture}.` };
  });
}

export async function annulerMouvement(id: string, motif: string): Promise<Resultat> {
  return operer(async ({ organizationId, userId }) => {
    if (!UUID.test(id)) return { ok: false, message: "Mouvement introuvable." };
    const { numero } = await db.transaction((tx) => annulerMouvementDans(tx, organizationId, id, motif, userId));
    return { ok: true, message: `${numero} annulé par contre-passation.` };
  });
}
