"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Briques communes aux écrans qui appellent une action serveur : retour
 * annoncé, formulaire repliable, opération en cours.
 */

/** Ce que rend toute action serveur des modules : un succès ou un refus lisible. */
export type Resultat = { ok: boolean; message: string };

/** Message de retour d'une opération, lisible et annoncé. */
export function Retour({ resultat }: { resultat: Resultat | null }) {
  if (!resultat) return null;
  return (
    <p
      role={resultat.ok ? "status" : "alert"}
      className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${
        resultat.ok ? "bg-valide-50 text-valide-600" : "bg-danger-50 text-danger-600"
      }`}
    >
      {resultat.message}
    </p>
  );
}

/**
 * Formulaire repliable branché sur une action serveur à FormData.
 * Se referme et se vide sur un succès ; garde la saisie sur un refus.
 */
export function FormulaireRepliable({
  libelle,
  titre,
  action,
  children,
  desactive,
}: {
  libelle: string;
  titre: string;
  action: (donnees: FormData) => Promise<Resultat>;
  children: ReactNode;
  desactive?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const formulaire = useRef<HTMLFormElement>(null);
  const routeur = useRouter();

  if (!ouvert) {
    return (
      <div className="flex flex-col items-end">
        <button
          type="button"
          disabled={desactive}
          onClick={() => {
            setOuvert(true);
            setResultat(null);
          }}
          className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
        >
          {libelle}
        </button>
        {resultat?.ok && <Retour resultat={resultat} />}
      </div>
    );
  }

  return (
    <form
      ref={formulaire}
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        demarrer(async () => {
          const r = await action(donnees);
          setResultat(r);
          if (r.ok) {
            setOuvert(false);
            routeur.refresh();
          }
        });
      }}
      className="mb-5 w-full rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 text-left"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{titre}</h2>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-sm text-[var(--encre-faible)] hover:underline"
        >
          Annuler
        </button>
      </div>
      {children}
      {resultat && !resultat.ok && <Retour resultat={resultat} />}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={enCours}
          className="h-cible rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

export function useOperation() {
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();
  return {
    resultat,
    enCours,
    lancer<R extends Resultat>(op: () => Promise<R>, apres?: (r: R) => void) {
      setResultat(null);
      demarrer(async () => {
        const r = await op();
        setResultat(r);
        if (r.ok) {
          apres?.(r);
          routeur.refresh();
        }
      });
    },
  };
}
