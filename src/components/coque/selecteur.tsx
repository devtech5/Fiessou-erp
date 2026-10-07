"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface OptionSelecteur {
  id: string;
  libelle: string;
  /** Étiquette collée au nom : « essai », « production », « ouvert ». */
  badge?: string;
  detail?: string;
}

interface Props {
  /** Ce qui est affiché quand le menu est fermé. */
  valeur: OptionSelecteur | null;
  options: OptionSelecteur[];
  /** Texte du champ de recherche : « Chercher une entreprise… ». */
  placeholderRecherche: string;
  /** Action proposée en pied de menu : « Nouvelle entreprise ». */
  actionCreation?: { libelle: string; onClick: () => void };
  /** Message affiché quand il n'y a rien d'autre à choisir. */
  messageVide?: string;
  onChoisir: (id: string) => void;
}

/**
 * Sélecteur de contexte, façon fil d'Ariane.
 *
 * Repris des tableaux de bord Vercel et Supabase : chaque niveau du fil est
 * lui-même un menu, avec une recherche en tête et une action de création en
 * pied. L'intérêt n'est pas esthétique — il évite une page de gestion séparée
 * pour changer d'entreprise, d'exercice ou de dépôt, et garde le contexte
 * courant lisible en permanence.
 *
 * La recherche n'apparaît qu'au-delà de sept entrées : sous ce seuil, un champ
 * de filtre ajoute une étape sans rien faire gagner.
 */
export function Selecteur({
  valeur,
  options,
  placeholderRecherche,
  actionCreation,
  messageVide,
  onChoisir,
}: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");
  const conteneur = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  const avecRecherche = options.length > 7;

  const resultats = useMemo(() => {
    const terme = filtre.trim().toLowerCase();
    if (!terme) return options;
    return options.filter(
      (option) =>
        option.libelle.toLowerCase().includes(terme) ||
        option.detail?.toLowerCase().includes(terme),
    );
  }, [options, filtre]);

  useEffect(() => {
    if (!ouvert) return;

    function auClic(evenement: MouseEvent) {
      if (!conteneur.current?.contains(evenement.target as Node)) {
        setOuvert(false);
      }
    }
    function auClavier(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") setOuvert(false);
    }

    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    if (avecRecherche) champ.current?.focus();

    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert, avecRecherche]);

  function choisir(id: string) {
    setOuvert(false);
    setFiltre("");
    onChoisir(id);
  }

  return (
    <div ref={conteneur} className="relative min-w-0 max-w-[15rem]">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="listbox"
        className="flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface-creuse)]"
      >
        <span className="truncate font-medium">
          {valeur?.libelle ?? "Choisir…"}
        </span>
        {valeur?.badge && (
          <span className="shrink-0 rounded border max-sm:hidden border-[var(--filet)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--encre-faible)]">
            {valeur.badge}
          </span>
        )}
        <span className="shrink-0 text-[var(--encre-faible)]" aria-hidden>
          ⌄
        </span>
      </button>

      {ouvert && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-72 overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)] shadow-lg"
        >
          {avecRecherche && (
            <div className="border-b border-[var(--filet)] p-2">
              <input
                ref={champ}
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
                placeholder={placeholderRecherche}
                className="h-9 w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-2.5 text-sm outline-none focus:border-marque-500"
              />
            </div>
          )}

          <ul className="max-h-72 overflow-y-auto p-1">
            {resultats.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-[var(--encre-faible)]">
                {filtre ? "Aucun résultat." : messageVide}
              </li>
            ) : (
              resultats.map((option) => {
                const actif = option.id === valeur?.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={actif}
                      onClick={() => choisir(option.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                        actif
                          ? "bg-[var(--surface-creuse)]"
                          : "hover:bg-[var(--surface-creuse)]"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">
                            {option.libelle}
                          </span>
                          {option.badge && (
                            <span className="shrink-0 rounded border border-[var(--filet)] px-1 text-[10px] font-semibold uppercase text-[var(--encre-faible)]">
                              {option.badge}
                            </span>
                          )}
                        </span>
                        {option.detail && (
                          <span className="block truncate text-xs text-[var(--encre-faible)]">
                            {option.detail}
                          </span>
                        )}
                      </span>

                      {/* La coche marque le contexte courant : dans une liste
                          longue, le seul surlignage ne suffit pas. */}
                      {actif && (
                        <span className="shrink-0 text-marque-600" aria-hidden>
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {actionCreation && (
            <div className="border-t border-[var(--filet)] p-1">
              <button
                type="button"
                onClick={() => {
                  setOuvert(false);
                  actionCreation.onClick();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-creuse)]"
              >
                <span className="text-[var(--encre-faible)]" aria-hidden>
                  +
                </span>
                {actionCreation.libelle}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
