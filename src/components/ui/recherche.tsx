import Link from "next/link";
import type { ReactNode } from "react";

import { CLASSE_CHAMP_COMPACT } from "./primitives";

/**
 * Recherche d'une liste, par l'adresse de la page (`?q=`).
 *
 * Un simple formulaire GET : il marche sans JavaScript, se partage par lien,
 * et le bouton « Retour » du navigateur rend la recherche précédente. La
 * liste se filtre côté serveur, avec la même normalisation partout.
 */
export function Recherche({
  valeur,
  placeholder,
  chemin,
  filtres,
  resultats,
}: {
  valeur: string;
  placeholder: string;
  /** Page cible : sert au lien d'effacement. */
  chemin: string;
  /** Champs supplémentaires du formulaire (un `select` de famille…). */
  filtres?: ReactNode;
  /** « 12 sur 36 » : affiché quand un filtre est actif. */
  resultats?: string;
}) {
  return (
    <form role="search" method="get" action={chemin} className="mb-3 flex flex-wrap items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={valeur}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${CLASSE_CHAMP_COMPACT} min-w-0 flex-1 sm:max-w-sm`}
      />
      {filtres}
      <button
        type="submit"
        className="h-cible rounded-lg border border-[var(--filet)] px-3.5 text-sm font-semibold hover:bg-[var(--surface-creuse)]"
      >
        Rechercher
      </button>
      {resultats && (
        <span className="text-xs text-[var(--encre-faible)]">
          {resultats} ·{" "}
          <Link href={chemin} className="font-semibold text-marque-600 hover:underline">
            Tout afficher
          </Link>
        </span>
      )}
    </form>
  );
}

/** Minuscules, sans accents : « Bébé » se trouve en tapant « bebe ». */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Vrai si tous les mots cherchés figurent dans l'un des champs. */
export function correspond(recherche: string, champs: (string | null | undefined)[]): boolean {
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const texte = normaliser(champs.filter(Boolean).join(" "));
  return mots.every((mot) => texte.includes(mot));
}
