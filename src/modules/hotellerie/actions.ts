"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerEntreprise } from "@/lib/auth/dal";
import type { Droit } from "@/lib/droits/catalogue";
import { refusDroit } from "@/lib/droits/garde";

import {
  ajouterPrestationPour,
  ajouterVoyageurPour,
  annulerSejourPour,
  arriveePour,
  aujourdHuiPour,
  creerChambrePour,
  departPour,
  modifierDatesPour,
  reglerChambrePour,
  reglerMenagePour,
  reserverSejourPour,
  retirerPrestationPour,
  verserAcomptePour,
} from "./creation";

export type Resultat = { ok: true; message: string; id?: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MOYEN = z.enum(["especes", "mobile_money", "banque"]);
const F = (montant: number) => `${montant.toLocaleString("fr-FR")} F`;

function texte(donnees: FormData, champ: string): string | null {
  const v = donnees.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** « 15 000 » → 15000 ; vide → null ; illisible → NaN, que zod refuse. */
function montant(donnees: FormData, champ: string): number | null {
  const v = texte(donnees, champ);
  return v === null ? null : Number(v.replace(/[\s  ]/g, ""));
}

/**
 * Opération du module : droit vérifié, jour de l'hôtel calculé, erreurs
 * traduites. Nos messages sont écrits pour l'utilisateur et remontent tels
 * quels ; le reste (SQL, réseau) reste au serveur.
 */
async function operer(
  droit: Droit,
  travail: (contexte: { organizationId: string; userId: string; jour: string }) => Promise<Resultat>,
): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit(droit);
  if (refus) return { ok: false, message: refus.erreur };
  try {
    const jour = await aujourdHuiPour(session.organizationId);
    const resultat = await travail({ organizationId: session.organizationId, userId: session.userId, jour });
    if (resultat.ok) {
      revalidatePath("/hotel", "layout");
      revalidatePath("/reservations", "layout");
      revalidatePath("/comptabilite", "layout");
    }
    return resultat;
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : "";
    const lisible = message && !message.startsWith("Failed query") && message.length < 240;
    if (!lisible) console.error("Hôtel : opération refusée", erreur);
    return { ok: false, message: lisible ? message : "L'opération n'a pas abouti. Réessayez." };
  }
}

// ----------------------------------------------------------------- chambres

const schemaChambre = z.object({
  numero: z.string().min(1, "Indiquez le numéro de la chambre.").max(20),
  designation: z.string().max(80).nullable(),
  categorie: z.string().max(60).nullable(),
  etage: z.string().max(30).nullable(),
  capacite: z.number().int("Capacité : un nombre entier.").min(1, "Capacité : au moins une personne.").max(20),
  tarifNuit: z.number().int().min(0).nullable(),
  tarifSemaine: z.number().int().min(0).nullable(),
  tarifMois: z.number().int().min(0).nullable(),
  caution: z.number().int().min(0).nullable(),
});

export async function creerChambre(donnees: FormData): Promise<Resultat> {
  return operer("hotellerie.chambre.gerer", async ({ organizationId, userId }) => {
    const analyse = schemaChambre.safeParse({
      numero: texte(donnees, "numero") ?? "",
      designation: texte(donnees, "designation"),
      categorie: texte(donnees, "categorie"),
      etage: texte(donnees, "etage"),
      capacite: Number(texte(donnees, "capacite") ?? "2"),
      tarifNuit: montant(donnees, "tarifNuit"),
      tarifSemaine: montant(donnees, "tarifSemaine"),
      tarifMois: montant(donnees, "tarifMois"),
      caution: montant(donnees, "caution"),
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    const { code } = await creerChambrePour(organizationId, { ...analyse.data, caution: analyse.data.caution ?? 0 }, userId);
    return { ok: true, message: `Chambre ${code} ajoutée.` };
  });
}

export async function reglerMenage(ressourceId: string, menage: "propre" | "a_faire"): Promise<Resultat> {
  return operer("hotellerie.menage", async ({ organizationId, userId }) => {
    if (!UUID.test(ressourceId) || (menage !== "propre" && menage !== "a_faire")) return { ok: false, message: "Chambre introuvable." };
    const code = await reglerMenagePour(organizationId, userId, ressourceId, menage);
    return { ok: true, message: menage === "propre" ? `Chambre ${code} prête.` : `Chambre ${code} à refaire.` };
  });
}

export async function mettreEnService(ressourceId: string, enService: boolean): Promise<Resultat> {
  return operer("hotellerie.chambre.gerer", async ({ organizationId, userId }) => {
    if (!UUID.test(ressourceId)) return { ok: false, message: "Chambre introuvable." };
    const code = await reglerChambrePour(organizationId, userId, ressourceId, { enService: Boolean(enService) });
    return { ok: true, message: enService ? `Chambre ${code} remise en service.` : `Chambre ${code} hors service.` };
  });
}

export async function reglerChambre(ressourceId: string, donnees: FormData): Promise<Resultat> {
  return operer("hotellerie.chambre.gerer", async ({ organizationId, userId }) => {
    if (!UUID.test(ressourceId)) return { ok: false, message: "Chambre introuvable." };
    const capacite = Number(texte(donnees, "capacite") ?? NaN);
    if (!Number.isInteger(capacite) || capacite < 1 || capacite > 20) return { ok: false, message: "Capacité : de 1 à 20 personnes." };
    const code = await reglerChambrePour(organizationId, userId, ressourceId, { etage: texte(donnees, "etage"), capacite });
    return { ok: true, message: `Chambre ${code} réglée.` };
  });
}

// ------------------------------------------------------------------ séjours

const schemaSejour = z.object({
  ressourceId: z.string().regex(UUID, "Choisissez une chambre."),
  clientId: z.string().regex(UUID).nullable(),
  nouveauClient: z.string().max(120).nullable(),
  telephone: z.string().max(30).nullable(),
  arrivee: z.string().regex(DATE_ISO, "Date d'arrivée invalide."),
  depart: z.string().regex(DATE_ISO, "Date de départ invalide."),
  adultes: z.number().int().min(1, "Au moins un adulte.").max(20),
  enfants: z.number().int().min(0).max(20),
  prixNuit: z.number().int("Tarif : un montant entier.").min(0).nullable(),
  notes: z.string().max(300).nullable(),
});

export async function reserverSejour(donnees: FormData): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId }) => {
    const client = texte(donnees, "clientId");
    const analyse = schemaSejour.safeParse({
      ressourceId: texte(donnees, "ressourceId") ?? "",
      clientId: client && client !== "nouveau" ? client : null,
      nouveauClient: texte(donnees, "nouveauClient"),
      telephone: texte(donnees, "telephone"),
      arrivee: texte(donnees, "arrivee") ?? "",
      depart: texte(donnees, "depart") ?? "",
      adultes: Number(texte(donnees, "adultes") ?? "1"),
      enfants: Number(texte(donnees, "enfants") ?? "0"),
      prixNuit: montant(donnees, "prixNuit"),
      notes: texte(donnees, "notes"),
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    const d = analyse.data;
    const { id, numero, montant: total } = await reserverSejourPour(
      organizationId,
      {
        ressourceId: d.ressourceId,
        clientId: d.clientId,
        nouveauClient: d.nouveauClient ? { nom: d.nouveauClient, telephone: d.telephone } : null,
        arrivee: d.arrivee,
        depart: d.depart,
        adultes: d.adultes,
        enfants: d.enfants,
        prixNuit: d.prixNuit,
        notes: d.notes,
      },
      userId,
    );
    return { ok: true, message: `${numero} réservé : ${F(total)} d'hébergement.`, id };
  });
}

export async function modifierDates(sejourId: string, donnees: FormData): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId }) => {
    const arrivee = texte(donnees, "arrivee") ?? "";
    const depart = texte(donnees, "depart") ?? "";
    if (!UUID.test(sejourId) || !DATE_ISO.test(arrivee) || !DATE_ISO.test(depart)) return { ok: false, message: "Dates invalides." };
    const { montant: total } = await modifierDatesPour(organizationId, userId, sejourId, { arrivee, depart });
    return { ok: true, message: `Dates changées : hébergement ${F(total)}.` };
  });
}

const schemaVoyageur = z.object({
  nom: z.string().min(2, "Indiquez le nom du voyageur.").max(80),
  prenoms: z.string().max(120).nullable(),
  dateNaissance: z.string().regex(DATE_ISO).nullable(),
  lieuNaissance: z.string().max(80).nullable(),
  nationalite: z.string().min(2, "Indiquez la nationalité.").max(60),
  profession: z.string().max(80).nullable(),
  domicile: z.string().max(160).nullable(),
  telephone: z.string().max(30).nullable(),
  pieceNature: z.string().min(2, "Indiquez la nature de la pièce d'identité.").max(60),
  pieceNumero: z.string().min(2, "Indiquez le numéro de la pièce d'identité.").max(60),
  pieceDelivreeLe: z.string().regex(DATE_ISO).nullable(),
  provenance: z.string().max(80).nullable(),
  destination: z.string().max(80).nullable(),
});

export async function ajouterVoyageur(sejourId: string, donnees: FormData): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId }) => {
    if (!UUID.test(sejourId)) return { ok: false, message: "Séjour introuvable." };
    const champs = Object.keys(schemaVoyageur.shape) as (keyof typeof schemaVoyageur.shape)[];
    const analyse = schemaVoyageur.safeParse(Object.fromEntries(champs.map((c) => [c, texte(donnees, c) ?? (c === "nom" || c === "nationalite" || c === "pieceNature" || c === "pieceNumero" ? "" : null)])));
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    await ajouterVoyageurPour(organizationId, userId, sejourId, analyse.data);
    return { ok: true, message: `Fiche de ${analyse.data.nom} enregistrée.` };
  });
}

export async function enregistrerArrivee(sejourId: string, moyenCaution: string | null): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId, jour }) => {
    if (!UUID.test(sejourId)) return { ok: false, message: "Séjour introuvable." };
    const moyen = moyenCaution ? MOYEN.safeParse(moyenCaution) : null;
    if (moyen && !moyen.success) return { ok: false, message: "Moyen de paiement invalide." };
    const { ecritureCaution } = await arriveePour(organizationId, userId, sejourId, moyen?.data ?? null, jour);
    return { ok: true, message: ecritureCaution ? `Client installé, caution reçue (écriture ${ecritureCaution}).` : "Client installé." };
  });
}

const schemaPrestation = z.object({
  libelle: z.string().min(2, "Décrivez la prestation.").max(120),
  nature: z.enum(["service", "marchandise"]),
  quantite: z.number().int("Quantité : un nombre entier.").min(1, "Quantité : au moins 1.").max(1000),
  prixUnitaire: z.number({ message: "Indiquez le prix." }).int("Prix : un montant entier.").min(0),
  tauxTva: z.number().int().min(0).max(10_000),
});

export async function ajouterPrestation(sejourId: string, donnees: FormData): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId, jour }) => {
    if (!UUID.test(sejourId)) return { ok: false, message: "Séjour introuvable." };
    const analyse = schemaPrestation.safeParse({
      libelle: texte(donnees, "libelle") ?? "",
      nature: texte(donnees, "nature") ?? "service",
      quantite: Number(texte(donnees, "quantite") ?? "1"),
      prixUnitaire: montant(donnees, "prixUnitaire") ?? undefined,
      tauxTva: Number(texte(donnees, "tauxTva") ?? "1800"),
    });
    if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
    await ajouterPrestationPour(organizationId, userId, sejourId, analyse.data, jour);
    return { ok: true, message: `${analyse.data.libelle} porté sur la note.` };
  });
}

export async function retirerPrestation(prestationId: string): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId }) => {
    if (!UUID.test(prestationId)) return { ok: false, message: "Ligne introuvable." };
    await retirerPrestationPour(organizationId, userId, prestationId);
    return { ok: true, message: "Ligne retirée de la note." };
  });
}

export async function verserAcompte(sejourId: string, donnees: FormData): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId, jour }) => {
    const somme = montant(donnees, "montant");
    const moyen = MOYEN.safeParse(texte(donnees, "moyen") ?? "especes");
    if (!UUID.test(sejourId) || somme === null || !Number.isInteger(somme) || somme <= 0 || !moyen.success) {
      return { ok: false, message: "Indiquez un montant positif." };
    }
    const { numero } = await verserAcomptePour(organizationId, userId, sejourId, { montant: somme, moyen: moyen.data }, jour);
    return { ok: true, message: `Acompte ${numero} de ${F(somme)} reçu.` };
  });
}

export async function enregistrerDepart(
  sejourId: string,
  reglement: { moyen: string | null; etat?: string; retenue?: number },
): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId, jour }) => {
    const moyen = reglement.moyen ? z.enum(["especes", "mobile_money", "banque", "credit"]).safeParse(reglement.moyen) : null;
    const etat = z.enum(["bon", "endommage", "perdu"]).safeParse(reglement.etat ?? "bon");
    const retenue = reglement.retenue ?? 0;
    if (!UUID.test(sejourId) || (moyen && !moyen.success) || !etat.success || !Number.isInteger(retenue) || retenue < 0) {
      return { ok: false, message: "Règlement invalide." };
    }
    const r = await departPour(organizationId, userId, sejourId, { moyen: moyen?.data ?? null, etat: etat.data, retenue }, jour);
    const solde = r.reste > 0 ? `${F(r.reste)} réglés` : r.reste < 0 ? `${F(-r.reste)} rendus au client` : "note déjà réglée";
    return { ok: true, message: `Départ enregistré : note de ${F(r.total)}, ${solde}. La chambre passe au ménage.` };
  });
}

export async function annulerSejour(sejourId: string, motif: string, sort: string | null): Promise<Resultat> {
  return operer("hotellerie.sejour.gerer", async ({ organizationId, userId, jour }) => {
    if (!UUID.test(sejourId)) return { ok: false, message: "Séjour introuvable." };
    let devenir: { rendre: "especes" | "mobile_money" | "banque" } | "conserver" | null = null;
    if (sort === "conserver") devenir = "conserver";
    else if (sort) {
      const moyen = MOYEN.safeParse(sort);
      if (!moyen.success) return { ok: false, message: "Choix invalide." };
      devenir = { rendre: moyen.data };
    }
    await annulerSejourPour(organizationId, userId, sejourId, motif, devenir, jour);
    return { ok: true, message: "Réservation annulée." };
  });
}
