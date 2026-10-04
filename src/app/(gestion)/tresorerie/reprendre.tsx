"use client";

import { Retour, useOperation } from "@/components/ui/operations";
import { reprendreComptes } from "@/modules/tresorerie/actions";

/** Déclare d'un geste les comptes de classe 5 que la comptabilité mouvemente déjà. */
export function ReprendreComptes() {
  const op = useOperation();
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={op.enCours}
        onClick={() => op.lancer(() => reprendreComptes())}
        className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)] disabled:opacity-50"
      >
        {op.enCours ? "Reprise…" : "Reprendre les comptes existants"}
      </button>
      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}
