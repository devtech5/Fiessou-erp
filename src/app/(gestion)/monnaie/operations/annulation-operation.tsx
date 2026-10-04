"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { annulerOperation } from "@/modules/monnaie/actions";

/** Annulation d'une opération saisie par erreur, motif obligatoire. */
export function AnnulationOperation({ id, numero }: { id: string; numero: string }) {
  const op = useOperation();
  const [motif, setMotif] = useState<string | null>(null);

  if (motif === null) {
    return (
      <button type="button" onClick={() => setMotif("")} className="text-xs font-medium text-danger-600 hover:underline">
        Annuler
      </button>
    );
  }

  return (
    <div className="min-w-56">
      <div className="flex items-center justify-end gap-1.5">
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          autoFocus
          placeholder="Motif"
          aria-label={`Motif d'annulation de ${numero}`}
          className={`${CLASSE_CHAMP} h-8 w-36 text-xs`}
        />
        <button
          type="button"
          disabled={op.enCours || motif.trim().length < 3}
          onClick={() => op.lancer(() => annulerOperation(id, motif), () => setMotif(null))}
          className="h-8 rounded-lg bg-danger-500 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Confirmer
        </button>
        <button type="button" onClick={() => setMotif(null)} aria-label="Fermer" className="text-xs text-[var(--encre-faible)]">
          ×
        </button>
      </div>
      {op.resultat && !op.resultat.ok && <Retour resultat={op.resultat} />}
    </div>
  );
}
