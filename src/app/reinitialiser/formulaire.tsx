"use client";

import { useActionState } from "react";

import { CLASSE_SAISIE } from "@/app/connexion/formulaire";
import { reinitialiserMotDePasse, type EtatReinitialisation } from "@/lib/auth/reinitialisation";
import { ChampMotDePasse } from "@/components/ui/mot-de-passe";

export function FormulaireReinitialisation({ jeton }: { jeton: string }) {
  const [etat, action, enCours] = useActionState<EtatReinitialisation, FormData>(reinitialiserMotDePasse, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="jeton" value={jeton} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Nouveau mot de passe</span>
        <ChampMotDePasse name="nouveau" autoComplete="new-password" required minLength={8} autoFocus className={CLASSE_SAISIE} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Confirmation</span>
        <ChampMotDePasse name="confirmation" autoComplete="new-password" required minLength={8} className={CLASSE_SAISIE} />
      </label>

      {etat.erreur && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-600">
          {etat.erreur}
        </p>
      )}

      <button type="submit" disabled={enCours} className="h-touche rounded-xl bg-marque-600 text-base font-semibold text-white disabled:opacity-60">
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
