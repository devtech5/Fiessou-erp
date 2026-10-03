"use client";

import { useActionState } from "react";

import { seConnecter, type EtatConnexion } from "@/lib/auth/actions";

export const CLASSE_SAISIE =
  "h-touche w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-4 text-base outline-none focus:border-marque-500";

/**
 * Connexion par adresse e-mail et mot de passe.
 *
 * Deux champs sur un seul écran, et les attributs `autocomplete` qui laissent
 * le gestionnaire de mots de passe du téléphone faire son travail : un mot de
 * passe qu'on peut enregistrer est un mot de passe qu'on n'écrit pas sur un
 * papier collé à la caisse.
 */
export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(
    seConnecter,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Adresse e-mail</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          defaultValue={etat.email}
          placeholder="vous@entreprise.ci"
          className={CLASSE_SAISIE}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Mot de passe</span>
        <input
          name="motDePasse"
          type="password"
          autoComplete="current-password"
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

      <button
        type="submit"
        disabled={enCours}
        className="sans-selection h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        {enCours ? "Un instant…" : "Se connecter"}
      </button>
    </form>
  );
}
