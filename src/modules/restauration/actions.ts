"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerEntreprise } from "@/lib/auth/dal";
import { peut, refusDroit } from "@/lib/droits/garde";
import { estDoublon, violeContrainte } from "@/lib/erreurs-pg";

import { DROITS_ESPACE, ESPACES, type Espace, type GesteSalle } from "./calcul";
import {
  annulerCommandePour,
  annulerLignePour,
  avancerLignesPour,
  basculerTablePour,
  creerPosteSallePour,
  creerTablePour,
  encaisserCommandePour,
  envoyerLignesPour,
  ouvrirCommandePour,
} from "./creation";
import { espaceDe } from "./requetes";

export type Resultat = { ok: true; message: string; id?: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schemaEspace = z.enum(["restaurant", "maquis"]);

function texte(donnees: FormData, champ: string): string | null {
  const v = donnees.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function entier(donnees: FormData, champ: string): number | null {
  const v = texte(donnees, champ);
  if (v === null) return null;
  const n = Number(v.replace(/[\s  ]/g, ""));
  return Number.isInteger(n) ? n : NaN;
}

function lisible(erreur: unknown): string {
  if (violeContrainte(erreur, "postes_caisse_code_unique")) return "Ce code de poste est déjà utilisé.";
  if (violeContrainte(erreur, "ventes_numero_unique")) return "Ce numéro de ticket est déjà pris sur ce poste. Réessayez.";
  if (estDoublon(erreur)) return "Cet élément existe déjà.";
  const message = erreur instanceof Error ? erreur.message : "";
  if (message && !message.startsWith("Failed query") && message.length < 240) return message;
  console.error("Restauration", erreur);
  return "L'opération n'a pas abouti. Réessayez.";
}

/**
 * Session, espace validé et droit du geste, dans cet ordre. Rend un refus
 * lisible plutôt que de lever : l'écran l'affiche sous le bouton.
 */
type Garde =
  | { refus: string }
  | { session: Awaited<ReturnType<typeof exigerEntreprise>>; espace: Espace };

async function garde(espace: unknown, geste: GesteSalle): Promise<Garde> {
  const session = await exigerEntreprise();
  const analyse = schemaEspace.safeParse(espace);
  if (!analyse.success) return { refus: "Espace inconnu." };
  const refus = await refusDroit(DROITS_ESPACE[analyse.data][geste]);
  if (refus) return { refus: refus.erreur };
  return { session, espace: analyse.data };
}

/** La cible appartient-elle à l'espace dont on vient de vérifier le droit ? */
async function memeEspace(
  organizationId: string,
  espace: Espace,
  cible: Parameters<typeof espaceDe>[1],
): Promise<boolean> {
  return (await espaceDe(organizationId, cible)) === espace;
}

function revalider(espace: Espace, encaissement = false) {
  revalidatePath(ESPACES[espace].racine, "layout");
  revalidatePath("/");
  if (encaissement) {
    revalidatePath("/commercial/ventes");
    revalidatePath("/stock", "layout");
    revalidatePath("/comptabilite");
    revalidatePath("/boutique");
  }
}

// ------------------------------------------------------------------- salle

const schemaTable = z.object({
  nom: z.string().min(1, "Indiquez le nom de la table.").max(40),
  zone: z.string().max(40).nullable(),
  places: z.number().int("Places : un nombre entier.").min(1).max(500).nullable(),
  ordre: z.number().int().min(0).max(10_000).nullable(),
});

export async function creerTable(espace: Espace, donnees: FormData): Promise<Resultat> {
  const g = await garde(espace, "gerer");
  if ("refus" in g) return { ok: false, message: g.refus };

  const analyse = schemaTable.safeParse({
    nom: texte(donnees, "nom") ?? "",
    zone: texte(donnees, "zone"),
    places: entier(donnees, "places"),
    ordre: entier(donnees, "ordre"),
  });
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };

  try {
    const id = await creerTablePour(
      g.session.organizationId,
      { espace: g.espace, ...analyse.data, ordre: analyse.data.ordre ?? 0 },
      g.session.userId,
    );
    revalider(g.espace);
    return { ok: true, message: `Table « ${analyse.data.nom} » ajoutée.`, id };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

export async function basculerTable(espace: Espace, tableId: string, actif: boolean): Promise<Resultat> {
  const g = await garde(espace, "gerer");
  if ("refus" in g) return { ok: false, message: g.refus };
  if (!UUID.test(tableId) || !(await memeEspace(g.session.organizationId, g.espace, { tableId }))) {
    return { ok: false, message: "Table inconnue." };
  }
  try {
    await basculerTablePour(g.session.organizationId, g.session.userId, tableId, actif);
    revalider(g.espace);
    return { ok: true, message: actif ? "Table remise sur le plan." : "Table retirée du plan." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

const schemaPoste = z.object({
  code: z
    .string()
    .min(2, "Indiquez un code de poste.")
    .max(10)
    .regex(/^[A-Za-z0-9-]+$/, "Le code ne prend que des lettres, chiffres et tirets."),
  nom: z.string().min(2, "Indiquez le nom du poste.").max(60),
  depotId: z.string().regex(UUID, "Choisissez le dépôt qui fournit la salle."),
});

export async function creerPosteSalle(espace: Espace, donnees: FormData): Promise<Resultat> {
  const g = await garde(espace, "gerer");
  if ("refus" in g) return { ok: false, message: g.refus };

  const analyse = schemaPoste.safeParse({
    code: texte(donnees, "code") ?? "",
    nom: texte(donnees, "nom") ?? "",
    depotId: texte(donnees, "depotId") ?? "",
  });
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };

  try {
    const { code } = await creerPosteSallePour(g.session.organizationId, g.session.userId, analyse.data);
    revalider(g.espace);
    revalidatePath("/commercial/ventes");
    return { ok: true, message: `Poste ${code} ouvert pour la salle.` };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

// --------------------------------------------------------------- commandes

const schemaOuverture = z.object({
  tableId: z.string().regex(UUID).nullable(),
  libelle: z.string().max(80).nullable(),
  couverts: z.number().int().min(1, "Couverts : au moins un.").max(500).nullable(),
});

export async function ouvrirCommande(
  espace: Espace,
  saisie: { tableId?: string | null; libelle?: string | null; couverts?: number | null },
): Promise<Resultat> {
  const g = await garde(espace, "prendre");
  if ("refus" in g) return { ok: false, message: g.refus };

  const analyse = schemaOuverture.safeParse({
    tableId: saisie.tableId ?? null,
    libelle: saisie.libelle?.trim() || null,
    couverts: saisie.couverts ?? null,
  });
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };

  try {
    const commande = await ouvrirCommandePour(g.session.organizationId, { espace: g.espace, ...analyse.data }, g.session.userId);
    revalider(g.espace);
    return {
      ok: true,
      message: commande.existante ? `Commande ${commande.numero} déjà ouverte sur cette table.` : `Commande ${commande.numero} ouverte.`,
      id: commande.id,
    };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

const schemaLignes = z
  .array(
    z.object({
      id: z.string().regex(UUID),
      articleId: z.string().regex(UUID),
      quantite: z.number().int().positive().max(1_000_000),
      note: z.string().trim().max(120).nullable().optional(),
      poste: z.enum(["cuisine", "bar"]),
    }),
  )
  .min(1, "Rien à envoyer.")
  .max(100, "Envoyez au plus cent lignes à la fois.");

export type LigneEnvoyee = z.input<typeof schemaLignes>[number];

export async function envoyerLignes(espace: Espace, commandeId: string, lignes: LigneEnvoyee[]): Promise<Resultat> {
  const g = await garde(espace, "prendre");
  if ("refus" in g) return { ok: false, message: g.refus };
  if (!UUID.test(commandeId) || !(await memeEspace(g.session.organizationId, g.espace, { commandeId }))) {
    return { ok: false, message: "Commande inconnue." };
  }
  const analyse = schemaLignes.safeParse(lignes);
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };

  try {
    const { envoyees } = await envoyerLignesPour(g.session.organizationId, g.session.userId, commandeId, analyse.data);
    revalider(g.espace);
    return {
      ok: true,
      message: envoyees === 0 ? "Déjà envoyé." : `${envoyees} ligne${envoyees > 1 ? "s" : ""} envoyée${envoyees > 1 ? "s" : ""}.`,
    };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

/**
 * Marque des lignes prêtes (cuisine, bar) ou servies (salle).
 *
 * Servir appartient au serveur comme au barman qui pose la bière sur le
 * comptoir : l'un ou l'autre droit suffit.
 */
export async function avancerLignes(espace: Espace, ligneIds: string[], vers: "prete" | "servie"): Promise<Resultat> {
  const session = await exigerEntreprise();
  const analyse = schemaEspace.safeParse(espace);
  if (!analyse.success) return { ok: false, message: "Espace inconnu." };
  const droits = DROITS_ESPACE[analyse.data];
  const autorise = vers === "prete" ? await peut(droits.preparer) : (await peut(droits.prendre)) || (await peut(droits.preparer));
  if (!autorise) {
    return { ok: false, message: (await refusDroit(vers === "prete" ? droits.preparer : droits.prendre))?.erreur ?? "Accès refusé." };
  }
  if (!Array.isArray(ligneIds) || ligneIds.length > 200 || !ligneIds.every((id) => UUID.test(id))) {
    return { ok: false, message: "Lignes inconnues." };
  }

  try {
    const { avancees } = await avancerLignesPour(session.organizationId, session.userId, analyse.data, ligneIds, vers);
    revalider(analyse.data);
    if (avancees === 0) return { ok: true, message: "Rien à changer : déjà fait." };
    return { ok: true, message: vers === "prete" ? "Marqué prêt." : "Marqué servi." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

export async function annulerLigne(espace: Espace, ligneId: string, motif: string): Promise<Resultat> {
  const g = await garde(espace, "prendre");
  if ("refus" in g) return { ok: false, message: g.refus };
  if (!UUID.test(ligneId) || !(await memeEspace(g.session.organizationId, g.espace, { ligneId }))) {
    return { ok: false, message: "Ligne inconnue." };
  }
  try {
    await annulerLignePour(g.session.organizationId, g.session.userId, ligneId, String(motif ?? ""));
    revalider(g.espace);
    return { ok: true, message: "Ligne annulée." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

export async function annulerCommande(espace: Espace, commandeId: string, motif: string): Promise<Resultat> {
  const g = await garde(espace, "annuler");
  if ("refus" in g) return { ok: false, message: g.refus };
  if (!UUID.test(commandeId) || !(await memeEspace(g.session.organizationId, g.espace, { commandeId }))) {
    return { ok: false, message: "Commande inconnue." };
  }
  try {
    await annulerCommandePour(g.session.organizationId, g.session.userId, commandeId, String(motif ?? ""));
    revalider(g.espace);
    return { ok: true, message: "Commande annulée." };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}

const schemaEncaissement = z.object({
  commandeId: z.string().regex(UUID),
  posteId: z.string().regex(UUID, "Choisissez le poste d'encaissement."),
  clientId: z.string().regex(UUID).nullable().optional(),
  remisePied: z.number().int().min(0).optional(),
  especesRecues: z.number().int().min(0).optional(),
  reglements: z
    .array(
      z.object({
        moyen: z.enum(["especes", "mobile_money", "carte", "banque", "credit"]),
        montant: z.number().int().positive(),
        reference: z.string().trim().max(80).nullable().optional(),
      }),
    )
    .min(1, "Un ticket sans règlement n'est pas encaissé."),
});

export type EncaissementEntrant = z.input<typeof schemaEncaissement>;

export type ResultatEncaissement =
  | { ok: true; message: string; ticket: string; totalTtc: number; encaisseeLe: string }
  | { ok: false; message: string };

export async function encaisserCommande(espace: Espace, saisie: EncaissementEntrant): Promise<ResultatEncaissement> {
  const g = await garde(espace, "encaisser");
  if ("refus" in g) return { ok: false, message: g.refus };
  const analyse = schemaEncaissement.safeParse(saisie);
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0].message };
  if (!(await memeEspace(g.session.organizationId, g.espace, { commandeId: analyse.data.commandeId }))) {
    return { ok: false, message: "Commande inconnue." };
  }

  const maintenant = new Date();
  try {
    const vente = await encaisserCommandePour(g.session.organizationId, g.session.userId, analyse.data, maintenant);
    revalider(g.espace, true);
    return {
      ok: true,
      message: `Commande ${vente.commande} encaissée : ticket ${vente.numero}.`,
      ticket: vente.numero,
      totalTtc: vente.totalTtc,
      encaisseeLe: maintenant.toISOString(),
    };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur) };
  }
}
