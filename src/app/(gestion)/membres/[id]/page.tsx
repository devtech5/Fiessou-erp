import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EnTetePage, Pastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { ficheAcces, modulesCoupes } from "@/lib/auth/acces";
import { niveauEffectif } from "@/lib/droits/acces";
import { modulesOuverts } from "@/lib/modules/garde";
import { getModule } from "@/modules/registry";

import { GrilleAcces, type LigneAcces } from "../grille-acces";

export const metadata: Metadata = { title: "Accès d'un utilisateur" };

/**
 * Accès d'un utilisateur, module par module.
 *
 * Le rôle fixe le plafond — ce qu'un caissier, un magasinier ou un comptable
 * peut faire. Cette page le resserre pour UNE personne, sans créer un rôle
 * sur mesure : le caissier de Treichville n'a pas besoin de voir le stock de
 * Yopougon.
 */
export default async function PageAccesMembre({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await exigerEntreprise();

  const [fiche, coupes] = await Promise.all([
    ficheAcces(session.organizationId, id),
    modulesCoupes(session.organizationId),
  ]);
  if (!fiche) notFound();

  const modifiable = !fiche.proprietaire && fiche.userId !== session.userId;

  const lignes: LigneAcces[] = modulesOuverts()
    .map((cle) => getModule(cle))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => {
      const niveau = fiche.niveaux.get(m.key) ?? "complet";
      return {
        cle: m.key,
        nom: m.name,
        description: m.description,
        niveau,
        effectif: fiche.proprietaire ? "complet" : niveauEffectif(fiche.droitsDuRole, m.key, niveau),
        coupe: coupes.has(m.key),
      };
    });

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/membres" className="text-marque-600 hover:underline">
          ← Utilisateurs
        </Link>
      </p>
      <EnTetePage
        titre={fiche.nom}
        sousTitre={`${fiche.email ?? "Sans adresse"} · rôle ${fiche.roleNom}`}
        actions={fiche.proprietaire ? <Pastille ton="marque">Propriétaire</Pastille> : undefined}
      />

      {!modifiable && (
        <p className="mb-4 rounded-lg bg-[var(--surface-creuse)] px-3 py-2.5 text-sm text-[var(--encre-douce)]">
          {fiche.proprietaire
            ? "Le propriétaire a accès à tout : l'entreprise lui appartient, une restriction ne doit pas pouvoir lui fermer sa propre porte."
            : "Vos propres accès se règlent par quelqu'un d'autre : se fermer un module ne laisserait personne pour le rouvrir."}
        </p>
      )}

      <GrilleAcces membershipId={fiche.membershipId} lignes={lignes} modifiable={modifiable} />

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Le niveau resserre le rôle, il ne l&apos;élargit jamais. « Complet » rend
        exactement ce que le rôle accorde ; « Consultation » ne laisse que la
        lecture ; « Aucun » fait disparaître le module de son menu. Pour donner
        davantage, changez son rôle.
      </p>
    </>
  );
}
