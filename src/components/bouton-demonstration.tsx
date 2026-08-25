"use client";

import { useState, useTransition } from "react";

import {
  installerDemonstration,
  type EtatInstallation,
} from "@/lib/fixtures/actions";

/**
 * Verse le jeu de démonstration dans l'entreprise active.
 *
 * Proposé sur les écrans vides, et uniquement là. Une entreprise qui a déjà
 * ses propres articles n'a rien à faire d'un catalogue de supérette
 * abidjanaise mélangé au sien.
 *
 * `useTransition` plutôt que `useActionState` : l'action ne prend ni état
 * précédent ni formulaire, elle n'a qu'un déclencheur et un résultat.
 */
export function BoutonDemonstration({
  libelle = "Charger le jeu de démonstration",
}: {
  libelle?: string;
}) {
  const [enCours, demarrer] = useTransition();
  const [etat, setEtat] = useState<EtatInstallation>({});

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => setEtat(await installerDemonstration()))
        }
        className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)] disabled:opacity-50"
      >
        {enCours ? "Installation…" : libelle}
      </button>

      {etat.message && <p className="text-xs text-valide-600">{etat.message}</p>}
      {etat.erreur && (
        <p role="alert" className="text-xs text-danger-600">
          {etat.erreur}
        </p>
      )}
    </div>
  );
}
