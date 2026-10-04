"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerEntreprise } from "@/lib/auth/dal";
import { peut, refusDroit } from "@/lib/droits/garde";
import { stockageConfigure, urlSignee } from "@/lib/stockage";

import { archiverPour, autoriserOuverture, retirerArchivePour, verifierArchivePour } from "./creation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Resultat = { ok: true; message: string } | { ok: false; message: string };

function lisible(erreur: unknown, contexte: string): string {
  const message = erreur instanceof Error ? erreur.message : "";
  if (message && !message.startsWith("Failed query") && message.length < 240) return message;
  console.error(`Archives : ${contexte}`, erreur);
  return "L'opération n'a pas abouti. Réessayez.";
}

const texte = (donnees: FormData, champ: string) => {
  const v = donnees.get(champ);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};

const schemaEnvoi = z.object({
  titre: z.string().max(160).optional(),
  dossier: z.string().max(60).optional(),
  description: z.string().max(1000).optional(),
});

export async function archiver(donnees: FormData): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("archives.deposer");
  if (refus) return { ok: false, message: refus.erreur };

  if (!stockageConfigure()) {
    return { ok: false, message: "Le dépôt de fichiers n'est pas configuré : rien ne peut être archivé." };
  }

  const analyse = schemaEnvoi.safeParse({
    titre: texte(donnees, "titre"),
    dossier: texte(donnees, "dossier"),
    description: texte(donnees, "description"),
  });
  if (!analyse.success) return { ok: false, message: "Titre, dossier ou description trop long." };

  const bruts = donnees.getAll("fichier").filter((v): v is File => v instanceof File && v.size > 0);

  try {
    const { numeros } = await archiverPour(session.organizationId, session.userId, {
      ...analyse.data,
      fichiers: await Promise.all(bruts.map(async (b) => ({ nom: b.name, typeMime: b.type, contenu: await b.arrayBuffer() }))),
    });
    revalidatePath("/archives", "layout");
    return {
      ok: true,
      message:
        numeros.length === 1
          ? `Archivé sous ${numeros[0]}.`
          : `${numeros.length} fichiers archivés (${numeros[0]} à ${numeros[numeros.length - 1]}).`,
    };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "dépôt refusé") };
  }
}

export async function retirerArchive(archiveId: string, motif: string): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("archives.deposer");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(archiveId)) return { ok: false, message: "Archive inconnue." };
  if (motif.trim().length < 3) return { ok: false, message: "Indiquez le motif du retrait." };

  try {
    const { numero } = await retirerArchivePour(session.organizationId, session.userId, archiveId, motif.trim().slice(0, 300));
    revalidatePath("/archives", "layout");
    return { ok: true, message: `${numero} retirée de votre espace.` };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "retrait refusé") };
  }
}

/**
 * Rend une URL de lecture valable cinq minutes, demandée au clic et jamais
 * posée dans la page. L'ouverture est journalisée avant que l'URL parte.
 */
export async function ouvrirArchive(archiveId: string): Promise<string | null> {
  const session = await exigerEntreprise();
  if (!UUID.test(archiveId)) return null;

  const [consulter, superviser] = await Promise.all([peut("archives.consulter"), peut("archives.superviser")]);
  if (!consulter && !superviser) return null;

  const chemin = await autoriserOuverture(session.organizationId, session.userId, archiveId, superviser);
  if (!chemin) return null;

  revalidatePath("/archives", "layout");
  return urlSignee(chemin);
}

export async function verifierArchive(archiveId: string): Promise<Resultat> {
  const session = await exigerEntreprise();
  const refus = await refusDroit("archives.superviser");
  if (refus) return { ok: false, message: refus.erreur };
  if (!UUID.test(archiveId)) return { ok: false, message: "Archive inconnue." };

  try {
    const r = await verifierArchivePour(session.organizationId, session.userId, archiveId);
    revalidatePath("/archives", "layout");
    if (r.etat === "conforme") return { ok: true, message: `${r.numero} intègre : le fichier n'a pas changé d'un octet depuis son dépôt.` };
    if (r.etat === "absent") return { ok: false, message: `${r.numero} : fichier introuvable dans le dépôt.` };
    return { ok: false, message: `${r.numero} ALTÉRÉE : l'empreinte relue ne correspond plus à celle du dépôt.` };
  } catch (erreur) {
    return { ok: false, message: lisible(erreur, "vérification impossible") };
  }
}
