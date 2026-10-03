import type { Metadata } from "next";
import Link from "next/link";

import { FormulaireInscription } from "./formulaire";

export const metadata: Metadata = { title: "Créer votre espace" };

export default function PageInscription() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fond)] p-4">
      <div className="w-full max-w-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Fiessou</h1>
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            Créez votre espace : votre compte et votre entreprise, en une fois.
          </p>
        </header>

        <div className="rounded-2xl border border-[var(--filet)] bg-[var(--surface)] p-5">
          <FormulaireInscription />
        </div>

        <p className="mt-4 text-center text-sm text-[var(--encre-douce)]">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-semibold text-marque-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
