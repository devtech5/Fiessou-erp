import type { Metadata } from "next";
import Link from "next/link";

import { FormulaireDemande } from "./formulaire";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function PageMotDePasseOublie() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fond)] p-4">
      <div className="w-full max-w-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            Indiquez l&apos;adresse de votre compte : vous recevrez un lien pour en choisir un nouveau.
          </p>
        </header>

        <div className="rounded-2xl border border-[var(--filet)] bg-[var(--surface)] p-5">
          <FormulaireDemande />
        </div>

        <p className="mt-4 text-center text-sm">
          <Link href="/connexion" className="font-semibold text-marque-600 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
