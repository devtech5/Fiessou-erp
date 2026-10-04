"use client";

/** Ouvre la boîte d'impression du navigateur, qui propose aussi « Enregistrer en PDF ». */
export function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-cible rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white hover:bg-marque-700"
    >
      Imprimer ou enregistrer en PDF
    </button>
  );
}
