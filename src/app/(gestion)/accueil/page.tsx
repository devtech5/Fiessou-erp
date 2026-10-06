import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { IconeModule } from "@/components/coque/icone-module";
import { exigerEntreprise } from "@/lib/auth/dal";
import { entreprisesAccessibles } from "@/lib/auth/entreprises";
import { droitsActifs } from "@/lib/droits/garde";
import { modulesOuverts } from "@/lib/modules/garde";
import { groupesVisibles, type CleIcone } from "@/lib/navigation";

export const metadata: Metadata = { title: "Accueil" };

/**
 * Écran d'arrivée après connexion : tous les modules que CETTE session peut
 * ouvrir, rangés par famille comme dans la barre latérale.
 *
 * Un lanceur, à la manière d'un écran de téléphone : une icône, un nom, rien
 * d'autre — on reconnaît une icône plus vite qu'on ne lit une phrase. La
 * description reste en infobulle et pour les lecteurs d'écran.
 *
 * Un caissier y voit la caisse et ses tâches ; un gérant, l'entreprise
 * entière. Rien n'y figure qui refuserait ensuite l'entrée : même filtre que
 * la barre (droit du rôle ET module ouvert), même liste (`lib/navigation`).
 */
export default async function PageAccueil() {
  const session = await exigerEntreprise();
  const [droits, entreprises] = await Promise.all([droitsActifs(), entreprisesAccessibles(session.userId)]);
  const groupes = groupesVisibles(droits, modulesOuverts());
  const role = entreprises.find((e) => e.id === session.organizationId)?.roleNom;
  const total = groupes.reduce((s, g) => s + g.modules.length, 0);

  const raccourcis: { href: string; libelle: string; description: string; icone: CleIcone }[] = [
    ...(droits.has("pos.vente.encaisser") ? [{ href: "/caisse", libelle: "Caisse", description: "Encaisser au comptoir, même sans réseau.", icone: "caisse" as const }] : []),
    { href: "/", libelle: "Tableau de bord", description: "Où est l'argent, ce que la journée a produit, ce qui attend une décision.", icone: "tableau-de-bord" },
  ];

  return (
    // Le fond dégradé couvre toute la zone de contenu, marges comprises.
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-[linear-gradient(160deg,var(--fond)_0%,var(--surface-creuse)_100%)] px-4 py-6 lg:-m-6 lg:min-h-[calc(100%+3rem)] lg:px-10 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight">Bonjour, {session.nom}</h1>
          <p className="mt-0.5 text-sm text-[var(--encre-douce)]">
            {session.organizationNom}
            {role && <> · {role}</>} · {total} module{total > 1 ? "s" : ""} accessible{total > 1 ? "s" : ""}
          </p>
        </div>

        <Grille>
          {raccourcis.map((r) => (
            <Tuile key={r.href} {...r} />
          ))}
        </Grille>

        {groupes.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-[var(--filet)] bg-[var(--surface)] p-6 text-sm text-[var(--encre-douce)]">
            Aucun module ne vous est encore ouvert dans cette entreprise. Adressez-vous à son responsable pour qu&apos;il vous attribue un rôle.
          </p>
        ) : (
          groupes.map((groupe) => (
            <section key={groupe.titre} aria-labelledby={`groupe-${groupe.titre}`} className="mt-8">
              <h2 id={`groupe-${groupe.titre}`} className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--encre-faible)]">
                {groupe.titre}
              </h2>
              <Grille>
                {groupe.modules.map((m) => (
                  <Tuile key={m.href} {...m} />
                ))}
              </Grille>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Grille({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{children}</ul>;
}

function Tuile({ href, libelle, description, icone }: { href: string; libelle: string; description: string; icone: CleIcone }) {
  return (
    <li>
      <Link href={href} title={description} className="group flex flex-col items-center gap-2 rounded-xl p-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-marque-500">
        <span className="flex size-16 items-center justify-center rounded-2xl border border-[var(--filet)] bg-[var(--surface)] shadow-sm transition duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md sm:size-[72px]">
          <IconeModule cle={icone} className="size-10 sm:size-11" />
        </span>
        <span className="text-xs font-medium leading-tight text-[var(--encre)] sm:text-sm">{libelle}</span>
        <span className="sr-only">{description}</span>
      </Link>
    </li>
  );
}
