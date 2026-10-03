import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { session } from "@/lib/auth/dal";

import { FormulaireMotDePasse } from "./formulaire";

export const metadata: Metadata = { title: "Mot de passe" };

/**
 * Changement de mot de passe.
 *
 * Hors de la coque de gestion, à dessein : c'est le seul écran qu'ouvre un
 * compte au mot de passe provisoire, et `exigerSession` y renverrait sans fin.
 * La session se lit donc directement ici.
 */
export default async function PageMotDePasse() {
  const active = await session();
  if (!active) redirect("/connexion");

  const provisoire = active.doitChangerMotDePasse;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fond)] p-4">
      <div className="w-full max-w-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {provisoire ? "Choisissez votre mot de passe" : "Changer de mot de passe"}
          </h1>
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            {provisoire
              ? "Le mot de passe qu'on vous a remis est provisoire : celui qui vous l'a donné le connaît. Remplacez-le pour continuer."
              : "Les autres appareils connectés à votre compte seront déconnectés."}
          </p>
        </header>

        <div className="rounded-2xl border border-[var(--filet)] bg-[var(--surface)] p-5">
          <FormulaireMotDePasse provisoire={provisoire} />
        </div>

        {!provisoire && (
          <p className="mt-4 text-center text-sm">
            <Link href="/" className="text-marque-600 hover:underline">
              Retour à l&apos;accueil
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
