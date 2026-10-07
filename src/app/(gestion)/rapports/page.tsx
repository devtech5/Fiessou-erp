import type { Metadata } from "next";
import Link from "next/link";

import { AccesRefuse } from "@/components/coque/acces-refuse";
import { EnTetePage, EtatVide, Pastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { droitsActifs } from "@/lib/droits/garde";
import { rapportsAccessibles } from "@/lib/rapports/registre";

export const metadata: Metadata = { title: "Rapports" };

/**
 * L'espace des rapports : tous ceux que la session peut ouvrir, rangés par
 * module. Depuis un module, le lien « Rapports » de sa barre arrive ici filtré
 * sur lui.
 */
export default async function PageRapports({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  await exigerEntreprise();
  const droits = await droitsActifs();
  if (!droits.has("rapports.consulter")) return <AccesRefuse droit="rapports.consulter" />;

  const { module } = await searchParams;
  const filtre = module ? module.split(",") : null;
  const tous = rapportsAccessibles(droits);
  const visibles = filtre ? tous.filter((r) => filtre.includes(r.module)) : tous;

  const rubriques = new Map<string, typeof visibles>();
  for (const r of visibles) {
    if (!rubriques.has(r.rubrique)) rubriques.set(r.rubrique, []);
    rubriques.get(r.rubrique)!.push(r);
  }

  return (
    <>
      <EnTetePage
        titre="Rapports"
        sousTitre="Choisissez un rapport, une période, puis imprimez-le ou ouvrez-le dans Excel"
        actions={
          filtre ? (
            <Link href="/rapports" className="h-cible inline-flex items-center rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]">
              Tous les rapports
            </Link>
          ) : undefined
        }
      />

      {visibles.length === 0 ? (
        <EtatVide
          titre="Aucun rapport disponible"
          message="Les rapports s'ouvrent selon vos droits sur chaque module. Demandez à l'administrateur l'accès au module qui vous intéresse."
        />
      ) : (
        <div className="space-y-6">
          {[...rubriques].map(([rubrique, rapports]) => (
            <section key={rubrique}>
              <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
                {rubrique}
                <Pastille>{rapports.length}</Pastille>
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {rapports.map((r) => (
                  <li key={r.cle}>
                    <Link
                      href={`/rapports/${r.cle}`}
                      className="block h-full rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 hover:border-marque-400"
                    >
                      <p className="text-sm font-semibold">{r.titre}</p>
                      <p className="mt-1 text-sm text-[var(--encre-douce)]">{r.description}</p>
                      <p className="mt-2 text-xs text-[var(--encre-faible)]">{r.periode === "situation" ? "Situation à une date" : "Sur une période"}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
