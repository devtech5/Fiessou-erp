"use client";

import { Retour, useOperation } from "@/components/ui/operations";
import { preparerCommandesReassort } from "@/modules/achats/actions";

/** Une commande en brouillon par fournisseur, depuis les articles sous leur seuil. */
export function PreparerReassort() {
  const op = useOperation();
  return (
    <div className="flex max-w-md flex-col items-end">
      <button
        type="button"
        disabled={op.enCours}
        onClick={() => op.lancer(() => preparerCommandesReassort())}
        className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)] disabled:opacity-50"
      >
        {op.enCours ? "Préparation…" : "Préparer le réassort"}
      </button>
      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}
