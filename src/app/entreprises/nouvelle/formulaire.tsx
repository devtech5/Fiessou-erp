"use client";

import { useActionState } from "react";

import { creerEntreprise, type EtatCreation } from "../actions";

const PAYS = [
  { code: "CI", nom: "Côte d'Ivoire" },
  { code: "SN", nom: "Sénégal" },
  { code: "BF", nom: "Burkina Faso" },
  { code: "ML", nom: "Mali" },
  { code: "TG", nom: "Togo" },
  { code: "BJ", nom: "Bénin" },
  { code: "CM", nom: "Cameroun" },
];

export function FormulaireEntreprise() {
  const [etat, action, enCours] = useActionState<EtatCreation, FormData>(
    creerEntreprise,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Nom de l&apos;entreprise
        </span>
        <input
          name="nom"
          autoFocus
          required
          placeholder="Supérette Akwaba"
          className="h-touche w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-4 text-base outline-none focus:border-marque-500"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Pays d&apos;exercice</span>
        <select
          name="pays"
          defaultValue="CI"
          className="h-touche w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-4 text-base outline-none focus:border-marque-500"
        >
          {PAYS.map((pays) => (
            <option key={pays.code} value={pays.code}>
              {pays.nom}
            </option>
          ))}
        </select>
        {/* Le pays n'est pas décoratif : il commande le plan comptable, les
            organismes sociaux, les taux de TVA et les moyens de paiement. */}
        <span className="mt-1.5 block text-xs text-[var(--encre-faible)]">
          Détermine la fiscalité, la paie et les moyens de paiement proposés.
        </span>
      </label>

      {etat.erreur && (
        <p
          role="alert"
          className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-600"
        >
          {etat.erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="sans-selection h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        {enCours ? "Création…" : "Créer l'entreprise"}
      </button>
    </form>
  );
}
