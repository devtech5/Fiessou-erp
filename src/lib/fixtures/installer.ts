import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { entityCodes } from "@/db/schema";
import { newId } from "@/lib/ids";
import { creerArticleDans, creerFamilleDans } from "@/modules/catalogue/creation";
import { articles } from "@/modules/catalogue/schema";
import { creerTiersDans } from "@/modules/tiers/creation";
import { tiers } from "@/modules/tiers/schema";

import { CATALOGUE, CATEGORIES, SEUIL_STOCK_BAS } from "./catalogue";
import { ALERTES, CLIENTS, FOURNISSEURS } from "./gestion";

/**
 * Installe le jeu de démonstration dans une entreprise réelle.
 *
 * Les fixtures ont longtemps servi d'affichage : les écrans lisaient
 * directement le tableau en mémoire. Elles changent de rôle ici — elles
 * deviennent une SOURCE D'AMORÇAGE. Les écrans lisent la base, et ce module y
 * verse de quoi faire une démonstration.
 *
 * La différence n'est pas cosmétique. Une donnée qui traverse la base traverse
 * aussi les contraintes, la numérotation, les comptes auxiliaires et le journal
 * d'audit. Un jeu de démonstration qui s'installe sans erreur prouve que le
 * modèle tient ; un tableau affiché directement ne prouve rien.
 */

/**
 * Prestations facturées en plus d'un article. Absentes du catalogue de
 * démonstration, elles figurent pourtant sur les factures — « Livraison
 * Bouaké », « Prestation de mise en place ». Il leur fallait un article de
 * type service, avec son compte 706 : c'est ce qui permet à une ligne de
 * montage de se rattacher à la pièce vendue sans se ventiler comme elle.
 */
const SERVICES = [
  { reference: "SRV-LIV", designation: "Livraison", prix: 15_000 },
  { reference: "SRV-MEP", designation: "Mise en place", prix: 25_000 },
  { reference: "SRV-MON", designation: "Montage et installation", prix: 10_000 },
];

export interface ResultatInstallation {
  deja: boolean;
  tiers: number;
  familles: number;
  articles: number;
  codes: number;
}

/** Code de famille sur trois lettres, désambiguïsé si deux catégories collent. */
function codeFamille(nom: string, pris: Set<string>): string {
  const base =
    nom
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3) || "FAM";

  let code = base;
  let suffixe = 1;
  while (pris.has(code)) code = `${base.slice(0, 2)}${suffixe++}`;
  pris.add(code);
  return code;
}

export async function installerJeuDemonstration(
  organizationId: string,
  userId?: string,
): Promise<ResultatInstallation> {
  // Idempotent : relancer pendant une démonstration ne doit rien dupliquer.
  if (!(await catalogueVide(organizationId))) {
    return { deja: true, tiers: 0, familles: 0, articles: 0, codes: 0 };
  }

  return db.transaction(async (tx) => {
    // ------------------------------------------------------------ familles
    const pris = new Set<string>();
    const familles = new Map<string, string>();

    for (const [index, categorie] of CATEGORIES.entries()) {
      const id = await creerFamilleDans(tx, organizationId, {
        code: codeFamille(categorie, pris),
        nom: categorie,
        ordre: index,
      });
      familles.set(categorie, id);
    }

    const familleServices = await creerFamilleDans(tx, organizationId, {
      code: "SRV",
      nom: "Prestations",
      // Un service se ventile en 706, pas en 701. Confondre les deux rend la
      // ventilation du chiffre d'affaires par nature inexploitable.
      compteVente: "706",
      compteAchat: "604",
      ordre: CATEGORIES.length,
    });

    // ----------------------------------------------------------- les tiers
    const fournisseurs = new Map<string, string>();

    for (const fournisseur of FOURNISSEURS) {
      const { id } = await creerTiersDans(
        tx,
        organizationId,
        {
          nom: fournisseur.nom,
          code: fournisseur.code,
          estClient: false,
          estFournisseur: true,
          telephone: fournisseur.telephone,
          identifiantFiscal: fournisseur.ncc ?? null,
          secteur: fournisseur.categorie,
          delaiLivraisonJours: fournisseur.delaiJours,
        },
        userId,
      );
      fournisseurs.set(fournisseur.nom, id);
    }

    for (const client of CLIENTS) {
      await creerTiersDans(
        tx,
        organizationId,
        {
          nom: client.nom,
          nature: client.type === "Particulier" ? "particulier" : "entreprise",
          estClient: true,
          estFournisseur: false,
          telephone: client.telephone,
          email: client.email ?? null,
          ville: client.ville,
          identifiantFiscal: client.ncc ?? null,
          // L'encours autorisé n'est pas l'encours constaté : on ouvre du
          // crédit à ceux qui en ont déjà, sans inventer de politique.
          plafondEncours: client.encours > 0 ? client.encours * 2 : 0,
          delaiReglementJours: client.encours > 0 ? 30 : 0,
        },
        userId,
      );
    }

    // -------------------------------------------------------- les articles
    // Le fournisseur habituel et le prix d'achat ne vivaient que dans les
    // alertes de réapprovisionnement : ils reviennent sur l'article, où ils
    // auraient toujours dû être.
    const approvisionnement = new Map(
      ALERTES.map((alerte) => [
        alerte.article,
        { fournisseur: alerte.fournisseur, prixAchat: alerte.prixAchat },
      ]),
    );

    let codes = 0;

    for (const article of CATALOGUE) {
      const appro = approvisionnement.get(article.designation);

      const { id } = await creerArticleDans(
        tx,
        organizationId,
        {
          reference: article.sku,
          designation: article.designation,
          unite: article.unite,
          conditionnement: article.conditionnement,
          prixVente: article.prix,
          prixAchat: appro?.prixAchat ?? 0,
          familleId: familles.get(article.categorie) ?? null,
          seuilAlerte: SEUIL_STOCK_BAS,
          fournisseurId: appro ? (fournisseurs.get(appro.fournisseur) ?? null) : null,
        },
        userId,
      );

      // Le code-barres du fabricant devient un code scannable, et non une
      // colonne de l'article : la référence interne et l'EAN doivent tous deux
      // répondre au scan, et un article peut en porter plusieurs.
      if (article.codeBarre) {
        await tx.insert(entityCodes).values({
          id: newId(),
          organizationId,
          entityType: "article",
          entityId: id,
          kind: "ean13",
          value: article.codeBarre,
          isPrimary: true,
        });
        codes++;
      }
    }

    for (const service of SERVICES) {
      await creerArticleDans(
        tx,
        organizationId,
        {
          reference: service.reference,
          designation: service.designation,
          type: "service",
          prixVente: service.prix,
          familleId: familleServices,
        },
        userId,
      );
    }

    return {
      deja: false,
      tiers: FOURNISSEURS.length + CLIENTS.length,
      familles: CATEGORIES.length + 1,
      articles: CATALOGUE.length + SERVICES.length,
      codes,
    };
  });
}

/**
 * L'entreprise n'a-t-elle ni article ni tiers ?
 *
 * Sert à ne proposer l'installation qu'à une base vide. Deux requêtes bornées
 * à une ligne, pas un `count` : on cherche l'existence, pas le nombre.
 */
export async function catalogueVide(organizationId: string): Promise<boolean> {
  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.organizationId, organizationId))
    .limit(1);

  if (article) return false;

  const [partenaire] = await db
    .select({ id: tiers.id })
    .from(tiers)
    .where(eq(tiers.organizationId, organizationId))
    .limit(1);

  return !partenaire;
}
