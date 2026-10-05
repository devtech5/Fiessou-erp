"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { refusDroit } from "@/lib/droits/garde";

import { enregistrerContactDans, retirerContactDans } from "./contacts";

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  nom: z.string().trim().min(2, "Nom requis.").max(100),
  fonction: z.string().trim().max(80).nullable().optional(),
  telephone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(120).nullable().optional(),
  principal: z.boolean().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});

async function operer(travail: (organizationId: string, userId: string) => Promise<Resultat>): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("tiers.fiche.gerer");
  if (refus) return { ok: false, message: refus.erreur };
  try {
    const r = await travail(session.organizationId, session.userId);
    if (r.ok) revalidatePath("/commercial", "layout");
    return r;
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 200;
    if (!lisible) console.error("Contacts : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

export async function enregistrerContact(tiersId: string, id: string | null, fiche: z.input<typeof schema>): Promise<Resultat> {
  return operer(async (organizationId, userId) => {
    if (!UUID.test(tiersId) || (id && !UUID.test(id))) return { ok: false, message: "Fiche introuvable." };
    const analyse = schema.safeParse(fiche);
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    await db.transaction((tx) => enregistrerContactDans(tx, organizationId, tiersId, id, analyse.data, userId));
    return { ok: true, message: `${analyse.data.nom} enregistré.` };
  });
}

export async function retirerContact(id: string): Promise<Resultat> {
  return operer(async (organizationId, userId) => {
    if (!UUID.test(id)) return { ok: false, message: "Contact introuvable." };
    const r = await db.transaction((tx) => retirerContactDans(tx, organizationId, id, userId));
    return { ok: true, message: `${r.nom} retiré des contacts.` };
  });
}
