import type { Metadata } from "next";

import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fond)] p-4">
      <div className="w-full max-w-sm">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Fiessou</h1>
          {/* Écrit pour un commerçant, pas pour un développeur. */}
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            Connectez-vous pour reprendre votre activité.
          </p>
        </header>

        <div className="rounded-2xl border border-[var(--filet)] bg-[var(--surface)] p-5">
          <FormulaireConnexion />
        </div>

        <p className="mt-4 text-center text-xs text-[var(--encre-faible)]">
          Pas encore de compte ? Saisissez votre numéro : il sera créé à la
          première connexion.
        </p>
      </div>
    </main>
  );
}
