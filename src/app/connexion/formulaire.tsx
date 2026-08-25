"use client";

import { useActionState } from "react";

import {
  demanderCode,
  finaliserInscription,
  verifierCodeConnexion,
  type EtatConnexion,
} from "@/lib/auth/actions";

const INITIAL: EtatConnexion = { etape: "telephone" };

/**
 * Connexion par numéro de téléphone.
 *
 * Le téléphone plutôt que l'e-mail : sur ce marché, beaucoup d'exploitants
 * n'ont pas d'adresse active, alors que tout le monde a un numéro. Le
 * concurrent impose l'e-mail, et son écran de connexion propose encore de
 * « se connecter à votre base de données » — le texte par défaut de son
 * constructeur, jamais remplacé.
 */
export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState(routeur, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Le numéro traverse les étapes sans être ressaisi. */}
      {etat.telephone && (
        <input type="hidden" name="telephone" value={etat.telephone} />
      )}
      <input type="hidden" name="etape" value={etat.etape} />

      {etat.etape === "telephone" && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Numéro de téléphone
          </span>
          <input
            name="telephone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            required
            placeholder="07 08 12 34 56"
            className="chiffres h-touche w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-4 text-base outline-none focus:border-marque-500"
          />
          <span className="mt-1.5 block text-xs text-[var(--encre-faible)]">
            Un code à six chiffres vous sera envoyé.
          </span>
        </label>
      )}

      {etat.etape === "code" && (
        <>
          {etat.codeDemo ? (
            <div className="rounded-xl border border-dashed border-alerte-600 bg-alerte-50 px-3 py-2.5 text-center">
              <p className="text-xs font-medium text-alerte-600">
                Démonstration — aucun SMS n&apos;est envoyé
              </p>
              <p className="chiffres mt-1 text-2xl font-bold tracking-[0.3em] text-alerte-600">
                {etat.codeDemo}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--encre-douce)]">
              Code envoyé au{" "}
              <span className="chiffres font-semibold text-[var(--encre)]">
                {etat.telephone}
              </span>
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Code reçu</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={6}
              placeholder="000000"
              className="chiffres h-touche w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-4 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:border-marque-500"
            />
          </label>
        </>
      )}

      {etat.etape === "inscription" && (
        <>
          <p className="rounded-lg bg-marque-50 px-3 py-2.5 text-sm text-marque-700">
            Numéro vérifié. Encore deux informations et votre espace est prêt.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Votre nom</span>
            <input
              name="nom"
              autoComplete="name"
              autoFocus
              required
              placeholder="Koffi Bernard"
              className="h-touche w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-4 text-base outline-none focus:border-marque-500"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Nom de votre entreprise
            </span>
            <input
              name="entreprise"
              autoComplete="organization"
              required
              placeholder="Supérette Akwaba"
              className="h-touche w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-4 text-base outline-none focus:border-marque-500"
            />
          </label>
        </>
      )}

      {etat.erreur && (
        <p
          role="alert"
          className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-600"
        >
          {etat.erreur}
        </p>
      )}

      {etat.message && !etat.erreur && (
        <p className="rounded-lg bg-[var(--surface-creuse)] px-3 py-2.5 text-xs text-[var(--encre-douce)]">
          {etat.message}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="sans-selection h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        {enCours
          ? "Un instant…"
          : etat.etape === "telephone"
            ? "Recevoir le code"
            : etat.etape === "code"
              ? "Se connecter"
              : "Créer mon espace"}
      </button>
    </form>
  );
}

/**
 * Aiguille vers l'action de l'étape en cours.
 *
 * `useActionState` n'accepte qu'une action ; l'étape est portée par le
 * formulaire lui-même plutôt que par trois états React séparés, ce qui évite
 * de désynchroniser l'affichage et le traitement.
 */
async function routeur(
  precedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const etape = String(donnees.get("etape") ?? "telephone");

  if (etape === "code") return verifierCodeConnexion(precedent, donnees);
  if (etape === "inscription") return finaliserInscription(precedent, donnees);
  return demanderCode(precedent, donnees);
}
