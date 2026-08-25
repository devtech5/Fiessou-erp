import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pastille } from "@/components/ui/primitives";
import { exigerSession } from "@/lib/auth/dal";
import { entreprisesAccessibles } from "@/lib/auth/entreprises";
import { activerEntreprise } from "./actions";

export const metadata: Metadata = { title: "Mes entreprises" };

const ETIQUETTE: Record<string, string> = {
  essai: "essai",
  actif: "actif",
  suspendu: "suspendu",
  resilie: "résilié",
};

/**
 * Choix de l'entreprise de travail.
 *
 * Écran atteint dans deux cas seulement : l'utilisateur n'a aucune entreprise
 * — juste après une invitation révoquée, par exemple — ou il en a plusieurs et
 * la session n'en désigne aucune.
 *
 * Avec une seule entreprise, on ne passe jamais ici : la session la sélectionne
 * d'elle-même. Un écran de choix à une ligne est une étape pour rien.
 */
export default async function PageEntreprises() {
  const session = await exigerSession();
  const entreprises = await entreprisesAccessibles(session.userId);

  if (entreprises.length === 0) redirect("/entreprises/nouvelle");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fond)] p-4">
      <div className="w-full max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Mes entreprises</h1>
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            Choisissez celle dans laquelle travailler.
          </p>
        </header>

        <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-2xl border border-[var(--filet)] bg-[var(--surface)]">
          {entreprises.map((entreprise) => (
            <li key={entreprise.id}>
              <form action={activerEntreprise}>
                <input type="hidden" name="organizationId" value={entreprise.id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--surface-creuse)]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marque-600 text-sm font-bold text-white">
                    {entreprise.nom.charAt(0).toUpperCase()}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {entreprise.nom}
                    </span>
                    <span className="block truncate text-xs text-[var(--encre-faible)]">
                      {entreprise.roleNom} · {entreprise.pays}
                    </span>
                  </span>

                  <Pastille ton={entreprise.statut === "actif" ? "valide" : "alerte"}>
                    {ETIQUETTE[entreprise.statut] ?? entreprise.statut}
                  </Pastille>
                </button>
              </form>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-sm">
          <Link
            href="/entreprises/nouvelle"
            className="text-marque-600 hover:underline"
          >
            Créer une nouvelle entreprise
          </Link>
        </p>
      </div>
    </main>
  );
}
