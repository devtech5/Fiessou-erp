import type { Metadata } from "next";
import Link from "next/link";

import { exigerSession } from "@/lib/auth/dal";
import { entreprisesAccessibles } from "@/lib/auth/entreprises";
import { FormulaireEntreprise } from "./formulaire";

export const metadata: Metadata = { title: "Nouvelle entreprise" };

export default async function PageNouvelleEntreprise() {
  const session = await exigerSession();
  const existantes = await entreprisesAccessibles(session.userId);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fond)] p-4">
      <div className="w-full max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle entreprise</h1>
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            Chaque entreprise a ses propres ventes, son stock et sa comptabilité.
            Rien n&apos;est partagé entre elles.
          </p>
        </header>

        <div className="rounded-2xl border border-[var(--filet)] bg-[var(--surface)] p-5">
          <FormulaireEntreprise />
        </div>

        {existantes.length > 0 && (
          <p className="mt-4 text-center text-sm">
            <Link href="/" className="text-marque-600 hover:underline">
              Revenir à {session.organizationNom ?? "mes entreprises"}
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
