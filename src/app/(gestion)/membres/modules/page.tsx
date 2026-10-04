import type { Metadata } from "next";

import { EnTetePage } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { modulesCoupes } from "@/lib/auth/acces";
import { peut } from "@/lib/droits/garde";
import { modulesOuverts } from "@/lib/modules/garde";
import { getModule } from "@/modules/registry";

import { BasculesModules } from "../grille-acces";

export const metadata: Metadata = { title: "Modules" };

const COUCHE = { socle: "Socle", moteur: "Moteur", metier: "Métier" } as const;

/**
 * Modules de l'entreprise.
 *
 * Une quincaillerie n'a que faire de la billetterie, un maquis de la gestion
 * de flotte. Couper un module le retire du menu de TOUT le monde, propriétaire
 * compris — c'est lui qui le rallume ici. Les données ne sont pas effacées :
 * rallumer le module les retrouve intactes.
 */
export default async function PageModules() {
  const session = await exigerEntreprise();
  const [coupes, modifiable] = await Promise.all([
    modulesCoupes(session.organizationId),
    peut("organisation.parametres.gerer"),
  ]);

  const modules = modulesOuverts()
    .map((cle) => getModule(cle))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => ({
      cle: m.key,
      nom: m.name,
      description: m.description,
      couche: COUCHE[m.layer],
      actif: !coupes.has(m.key),
    }));

  return (
    <>
      <EnTetePage
        titre="Modules"
        sousTitre={`${modules.filter((m) => m.actif).length} actifs sur ${modules.length}`}
      />
      {!modifiable && (
        <p className="mb-4 rounded-lg bg-[var(--surface-creuse)] px-3 py-2.5 text-sm text-[var(--encre-douce)]">
          Seul le propriétaire active ou coupe un module : le geste vaut pour toute l&apos;entreprise.
        </p>
      )}
      <BasculesModules modules={modules} modifiable={modifiable} />
      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Couper un module ne supprime rien : ses données restent en base et
        réapparaissent dès qu&apos;on le rallume.
      </p>
    </>
  );
}
