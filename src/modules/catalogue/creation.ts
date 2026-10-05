import "server-only";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { newId } from "@/lib/ids";
import type { CodeUnite } from "@/lib/quantite";
import { prochainNumero, type Transaction } from "@/lib/sequences";
import { articles, famillesArticle } from "./schema";

export interface NouvelArticle {
  designation: string;
  /** Référence imposée. Nulle : attribuée par le compteur. */
  reference?: string | null;
  type?: "marchandise" | "service";
  unite?: CodeUnite;
  conditionnement?: string | null;
  prixVente: number;
  prixAchat?: number;
  familleId?: string | null;
  tauxTva?: number | null;
  compteVente?: string | null;
  compteAchat?: string | null;
  seuilAlerte?: number;
  fournisseurId?: string | null;
  /** Déclinaison d'un modèle : son modèle et la valeur de chaque axe. */
  modeleId?: string | null;
  attributs?: Record<string, string> | null;
}

export interface NouvelleFamille {
  code: string;
  nom: string;
  compteVente?: string;
  compteAchat?: string;
  /** En points de base : 1800 = 18 %. */
  tauxTva?: number;
  ordre?: number;
}

export async function creerFamilleDans(
  tx: Transaction,
  organizationId: string,
  donnees: NouvelleFamille,
): Promise<string> {
  const id = newId();

  await tx.insert(famillesArticle).values({
    id,
    organizationId,
    code: donnees.code,
    nom: donnees.nom,
    compteVente: donnees.compteVente ?? "701",
    compteAchat: donnees.compteAchat ?? "601",
    tauxTva: donnees.tauxTva ?? 1800,
    ordre: donnees.ordre ?? 0,
  });

  return id;
}

/**
 * Crée un article et lui attribue sa référence.
 *
 * La référence peut être imposée — l'exploitant qui reprend son ancien fichier
 * garde ses codes — ou attribuée par le compteur quand le champ est laissé
 * vide. Une référence tapée à la main reste préférable là où elle existe : elle
 * est déjà écrite sur les étiquettes de rayon.
 */
export async function creerArticleDans(
  tx: Transaction,
  organizationId: string,
  donnees: NouvelArticle,
  userId?: string,
): Promise<{ id: string; reference: string }> {
  const type = donnees.type ?? "marchandise";

  const reference =
    donnees.reference?.trim() ||
    (await prochainNumero(tx, organizationId, {
      cle: "article",
      prefix: "A",
      padding: 5,
    }));

  const id = newId();

  await tx.insert(articles).values({
    id,
    organizationId,
    familleId: donnees.familleId ?? null,
    reference,
    designation: donnees.designation.trim(),
    type,
    unite: donnees.unite ?? "piece",
    conditionnement: donnees.conditionnement ?? null,
    prixVente: donnees.prixVente,
    prixAchat: donnees.prixAchat ?? 0,
    tauxTva: donnees.tauxTva ?? null,
    compteVente: donnees.compteVente ?? null,
    compteAchat: donnees.compteAchat ?? null,
    // Un service ne se stocke pas : la base le refuse, autant ne pas le lui
    // demander. La règle est ici et dans la contrainte, parce qu'une insertion
    // peut aussi venir d'une synchronisation qui ne passe pas par ce code.
    suiviStock: type !== "service",
    seuilAlerte: type === "service" ? 0 : (donnees.seuilAlerte ?? 0),
    fournisseurId: donnees.fournisseurId ?? null,
    modeleId: donnees.modeleId ?? null,
    attributs: donnees.attributs ?? null,
  });

  if (userId) {
    await tx.insert(auditLogs).values({
      id: newId(),
      organizationId,
      userId,
      action: "article.creer",
      entityType: "article",
      entityId: id,
      after: { reference, designation: donnees.designation, prixVente: donnees.prixVente },
    });
  }

  return { id, reference };
}

/** Même chose, hors d'une transaction existante. */
export async function creerArticlePour(
  organizationId: string,
  donnees: NouvelArticle,
  userId?: string,
): Promise<{ id: string; reference: string }> {
  return db.transaction((tx) => creerArticleDans(tx, organizationId, donnees, userId));
}
