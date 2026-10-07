"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { fmt } from "@/lib/format";
import { definirBudget } from "@/modules/tresorerie/actions-charges";

/**
 * Enveloppe mensuelle d'une famille, modifiable sur place par qui gère les
 * charges. Vider le champ retire l'enveloppe.
 */
export function CelluleBudget({ famille, budget, modifiable }: { famille: string; budget: number | null; modifiable: boolean }) {
  const [edition, setEdition] = useState(false);
  const { resultat, enCours, lancer } = useOperation();

  if (!modifiable) return <span className="chiffres">{budget ? fmt(budget) : "—"}</span>;

  if (!edition) {
    return (
      <span className="inline-flex flex-col items-end">
        <button
          type="button"
          onClick={() => setEdition(true)}
          title="Fixer l'enveloppe mensuelle"
          className="chiffres rounded px-1 underline decoration-dotted underline-offset-4 hover:bg-[var(--surface-creuse)]"
        >
          {budget ? fmt(budget) : "Fixer"}
        </button>
        {resultat && !resultat.ok && <Retour resultat={resultat} />}
      </span>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const saisie = String(new FormData(e.currentTarget).get("montant") ?? "");
        lancer(() => definirBudget(famille, saisie), () => setEdition(false));
      }}
      className="inline-flex items-center gap-1"
    >
      <input
        name="montant"
        autoFocus
        inputMode="numeric"
        defaultValue={budget ? String(budget) : ""}
        placeholder="0"
        aria-label="Budget mensuel en FCFA"
        onKeyDown={(e) => e.key === "Escape" && setEdition(false)}
        className="chiffres h-8 w-28 rounded-md border border-[var(--filet)] bg-[var(--fond)] px-2 text-right text-sm outline-none focus:border-marque-500"
      />
      <button type="submit" disabled={enCours} className="h-8 rounded-md bg-marque-600 px-2 text-xs font-semibold text-white disabled:opacity-50">
        OK
      </button>
    </form>
  );
}
