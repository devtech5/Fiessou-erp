"use client";

import { useActionState } from "react";

import { changerMotDePasse, type EtatMotDePasse } from "@/lib/auth/actions";
import { LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/auth/identifiants";

import { CLASSE_SAISIE } from "../connexion/formulaire";
import { ChampMotDePasse } from "@/components/ui/mot-de-passe";

export function FormulaireMotDePasse({ provisoire }: { provisoire: boolean }) {
  const [etat, action, enCours] = useActionState<EtatMotDePasse, FormData>(
    changerMotDePasse,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          {provisoire ? "Mot de passe provisoire" : "Mot de passe actuel"}
        </span>
        <ChampMotDePasse
          name="actuel"
          autoComplete="current-password"
          autoFocus
          required
          className={CLASSE_SAISIE}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Nouveau mot de passe</span>
        <ChampMotDePasse
          name="nouveau"
          autoComplete="new-password"
          required
          minLength={LONGUEUR_MIN_MOT_DE_PASSE}
          className={CLASSE_SAISIE}
        />
        <span className="mt-1.5 block text-xs text-[var(--encre-faible)]">
          Au moins {LONGUEUR_MIN_MOT_DE_PASSE} caractères.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Confirmez</span>
        <ChampMotDePasse
          name="confirmation"
          autoComplete="new-password"
          required
          className={CLASSE_SAISIE}
        />
      </label>

      {etat.erreur && (
        <p
          role="alert"
          className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-600"
        >
          {etat.erreur}
        </p>
      )}

      {etat.change && (
        <p role="status" className="rounded-lg bg-valide-50 px-3 py-2.5 text-sm font-medium text-valide-600">
          Mot de passe changé.
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="sans-selection h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        {enCours ? "Un instant…" : "Enregistrer"}
      </button>
    </form>
  );
}
