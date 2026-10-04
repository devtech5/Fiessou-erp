"use client";

import { useState } from "react";

import { annulerTicket } from "@/modules/ventes/actions";

/**
 * Annulation d'un ticket, motif obligatoire.
 *
 * Annuler pose l'avoir : la marchandise revient en stock et l'écriture est
 * contrepassée. Le geste défait une recette — d'où le motif, et le droit
 * réservé à qui répond de la caisse.
 */
export function AnnulationTicket({ id, numero }: { id: string; numero: string }) {
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-xs font-medium text-danger-600 hover:underline"
      >
        Annuler
      </button>
    );
  }

  return (
    <form action={annulerTicket} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input
        name="motif"
        required
        minLength={3}
        autoFocus
        placeholder="Motif"
        aria-label={`Motif d'annulation du ticket ${numero}`}
        className="h-8 w-36 rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-2 text-xs"
      />
      <button type="submit" className="h-8 rounded-lg bg-danger-500 px-2.5 text-xs font-semibold text-white">
        Confirmer
      </button>
      <button type="button" onClick={() => setOuvert(false)} className="text-xs text-[var(--encre-faible)]">
        ×
      </button>
    </form>
  );
}
