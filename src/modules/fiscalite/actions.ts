"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import type { Droit } from "@/lib/droits/catalogue";
import { refusDroit } from "@/lib/droits/garde";

import { moisValide } from "./calcul";
import { cloturerExerciceDans, declarerTvaDans, payerTvaDans } from "./creation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const fr = (n: number) => n.toLocaleString("fr-FR");

async function operer(droit: Droit, travail: (organizationId: string, userId: string) => Promise<Resultat>): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit(droit);
  if (refus) return { ok: false, message: refus.erreur };
  try {
    const r = await travail(session.organizationId, session.userId);
    if (r.ok) {
      revalidatePath("/comptabilite", "layout");
      revalidatePath("/tresorerie", "layout");
      revalidatePath("/");
    }
    return r;
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 240;
    if (!lisible) console.error("Fiscalité : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

export async function declarerTva(mois: string): Promise<Resultat> {
  return operer("comptabilite.fiscalite.declarer", async (organizationId, userId) => {
    if (!moisValide(mois)) return { ok: false, message: "Mois invalide." };
    const r = await db.transaction((tx) => declarerTvaDans(tx, organizationId, mois, aujourdhui(), userId));
    const suite = r.aPayer > 0 ? `${fr(r.aPayer)} F à reverser` : r.creditReporte > 0 ? `crédit de ${fr(r.creditReporte)} F reporté` : "déclaration néant";
    return { ok: true, message: `TVA de ${mois} déclarée : ${suite}${r.ecriture ? `, écriture ${r.ecriture}` : ""}.` };
  });
}

export async function payerTva(mois: string, paiement: { compteTresorerieId: string; date: string }): Promise<Resultat> {
  return operer("comptabilite.fiscalite.declarer", async (organizationId, userId) => {
    if (!moisValide(mois)) return { ok: false, message: "Mois invalide." };
    if (!UUID.test(paiement.compteTresorerieId)) return { ok: false, message: "Choisissez le compte qui paie." };
    if (!DATE_ISO.test(paiement.date)) return { ok: false, message: "Date invalide." };
    const r = await db.transaction((tx) => payerTvaDans(tx, organizationId, mois, paiement, userId));
    return { ok: true, message: `TVA de ${mois} payée : ${fr(r.montant)} F, écriture ${r.ecriture}.` };
  });
}

export async function cloturerExercice(exercice: string): Promise<Resultat> {
  return operer("comptabilite.exercice.cloturer", async (organizationId, userId) => {
    if (!/^\d{4}$/.test(exercice)) return { ok: false, message: "Exercice invalide." };
    const r = await db.transaction((tx) => cloturerExerciceDans(tx, organizationId, exercice, aujourdhui(), userId));
    const sens = r.resultat >= 0 ? `bénéfice de ${fr(r.resultat)} F` : `perte de ${fr(-r.resultat)} F`;
    return { ok: true, message: `Exercice ${exercice} clôturé : ${sens}, écriture ${r.ecriture}.` };
  });
}
