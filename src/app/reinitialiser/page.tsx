import type { Metadata } from "next";
import Link from "next/link";

import { jetonValable } from "@/lib/auth/reinitialisation";

import { FormulaireReinitialisation } from "./formulaire";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function PageReinitialiser({ searchParams }: PageProps<"/reinitialiser">) {
  const { jeton } = await searchParams;
  const valable = typeof jeton === "string" && (await jetonValable(jeton));

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fond)] p-4">
      <div className="w-full max-w-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            {valable ? "Choisissez-le : toutes vos sessions ouvertes seront fermées." : "Ce lien a expiré ou a déjà servi."}
          </p>
        </header>

        <div className="rounded-2xl border border-[var(--filet)] bg-[var(--surface)] p-5">
          {valable ? (
            <FormulaireReinitialisation jeton={jeton as string} />
          ) : (
            <Link href="/mot-de-passe-oublie" className="font-semibold text-marque-600 hover:underline">
              Demander un nouveau lien
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
