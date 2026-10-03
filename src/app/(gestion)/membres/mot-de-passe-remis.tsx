"use client";

import { useState } from "react";

/**
 * Mot de passe provisoire, montré une seule fois.
 *
 * Il n'est stocké nulle part en clair : fermer ce cadre, c'est le perdre, et
 * il faudra en générer un autre. L'écran le dit plutôt que de laisser croire
 * qu'on le retrouvera plus tard.
 */
export function MotDePasseRemis({
  nom,
  email,
  motDePasse,
  onFermer,
}: {
  nom: string;
  email: string;
  motDePasse: string;
  onFermer: () => void;
}) {
  const [copie, setCopie] = useState(false);

  return (
    <div
      role="status"
      className="mb-5 rounded-xl border border-alerte-300 bg-alerte-50 p-4 text-left text-sm"
    >
      <p className="font-semibold text-[var(--encre)]">
        Accès prêt pour {nom}
      </p>
      <p className="mt-1 text-[var(--encre-douce)]">
        Remettez-lui ces identifiants. Le mot de passe est provisoire : il devra
        le remplacer à sa première connexion. Il ne sera plus affiché.
      </p>
      <dl className="mt-3 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-[var(--encre-faible)]">Adresse</dt>
        <dd className="font-medium">{email}</dd>
        <dt className="text-[var(--encre-faible)]">Mot de passe</dt>
        <dd className="chiffres text-base font-bold tracking-wide">{motDePasse}</dd>
      </dl>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(`${email}\n${motDePasse}`)
              .then(() => setCopie(true));
          }}
          className="rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3 py-1.5 font-medium"
        >
          {copie ? "Copié" : "Copier"}
        </button>
        <button
          type="button"
          onClick={onFermer}
          className="text-[var(--encre-faible)] hover:underline"
        >
          C&apos;est noté, fermer
        </button>
      </div>
    </div>
  );
}
