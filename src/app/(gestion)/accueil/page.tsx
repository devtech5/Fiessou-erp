import type { Metadata } from "next";
import Link from "next/link";

import { exigerEntreprise } from "@/lib/auth/dal";
import { entreprisesAccessibles } from "@/lib/auth/entreprises";
import { droitsActifs } from "@/lib/droits/garde";
import { modulesOuverts } from "@/lib/modules/garde";
import { groupesVisibles } from "@/lib/navigation";

export const metadata: Metadata = { title: "Accueil" };

/**
 * Écran d'arrivée après connexion : tous les modules que CETTE session peut
 * ouvrir, rangés par famille comme dans la barre latérale.
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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bonjour, {session.nom}</h1>
          <p className="mt-0.5 text-sm text-[var(--encre-douce)]">
            {session.organizationNom}
            {role && <> · {role}</>} · {total} module{total > 1 ? "s" : ""} accessible{total > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {droits.has("pos.vente.encaisser") && (
            <Link href="/caisse" className="h-cible flex items-center rounded-lg bg-marque-500 px-4 text-sm font-semibold text-white hover:bg-marque-600">
              Ouvrir la caisse
            </Link>
          )}
          <Link href="/" className="h-cible flex items-center rounded-lg border border-[var(--filet)] px-4 text-sm font-medium hover:bg-[var(--surface-creuse)]">
            Tableau de bord
          </Link>
        </div>
      </div>

      {groupes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--filet)] bg-[var(--surface)] p-6 text-sm text-[var(--encre-douce)]">
          Aucun module ne vous est encore ouvert dans cette entreprise. Adressez-vous à son responsable pour qu&apos;il vous attribue un rôle.
        </p>
      ) : (
        <div className="space-y-6">
          {groupes.map((groupe) => (
            <section key={groupe.titre} aria-labelledby={`groupe-${groupe.titre}`}>
              <h2 id={`groupe-${groupe.titre}`} className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--encre-faible)]">
                {groupe.titre}
                <span className="chiffres font-medium normal-case tracking-normal">{groupe.modules.length}</span>
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {groupe.modules.map((m) => (
                  <li key={m.href}>
                    <Link
                      href={m.href}
                      className="flex h-full items-start gap-3 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-3 hover:border-marque-400 sm:p-4"
                    >
                      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marque-50 text-sm font-bold text-marque-600">
                        {m.libelle.charAt(0)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{m.libelle}</span>
                        <span className="mt-0.5 block text-xs text-[var(--encre-douce)]">{m.description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
