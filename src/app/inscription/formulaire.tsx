"use client";

import { useActionState } from "react";

import { sInscrire, type EtatInscription } from "@/lib/auth/actions";
import { LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/auth/identifiants";

import { CLASSE_SAISIE } from "../connexion/formulaire";

export function FormulaireInscription() {
  const [etat, action, enCours] = useActionState<EtatInscription, FormData>(
    sInscrire,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Votre nom</span>
        <input
          name="nom"
          autoComplete="name"
          autoFocus
          required
          defaultValue={etat.valeurs?.nom}
          placeholder="Koffi Bernard"
          className={CLASSE_SAISIE}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Nom de votre entreprise</span>
        <input
          name="entreprise"
          autoComplete="organization"
          required
          defaultValue={etat.valeurs?.entreprise}
          placeholder="Supérette Akwaba"
          className={CLASSE_SAISIE}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Adresse e-mail</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={etat.valeurs?.email}
          placeholder="vous@entreprise.ci"
          className={CLASSE_SAISIE}
        />
        <span className="mt-1.5 block text-xs text-[var(--encre-faible)]">
          C&apos;est avec elle que vous vous connecterez.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Mot de passe</span>
        <input
          name="motDePasse"
          type="password"
          autoComplete="new-password"
          required
          minLength={LONGUEUR_MIN_MOT_DE_PASSE}
          className={CLASSE_SAISIE}
        />
        <span className="mt-1.5 block text-xs text-[var(--encre-faible)]">
          Au moins {LONGUEUR_MIN_MOT_DE_PASSE} caractères. Une courte phrase se
          retient mieux qu&apos;un mot compliqué.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Confirmez le mot de passe</span>
        <input
          name="confirmation"
          type="password"
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

      <button
        type="submit"
        disabled={enCours}
        className="sans-selection h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        {enCours ? "Un instant…" : "Créer mon espace"}
      </button>
    </form>
  );
}
