import Link from "next/link";

import { fmt, fmtCompact } from "@/lib/format";
import { libelleMois } from "@/modules/tresorerie/charges";

const COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * Charges mois par mois, sur douze mois.
 *
 * Une seule série : une seule teinte, le mois choisi plus soutenu. Chaque barre
 * est un lien — cliquer un mois l'ouvre en dessous — et porte son montant au
 * survol comme au focus clavier. Le tableau par nature, juste en dessous, sert
 * de vue chiffrée.
 */
export function GraphiqueMois({
  mois,
  totaux,
  choisi,
  lien,
}: {
  mois: readonly string[];
  totaux: Record<string, number>;
  choisi: string;
  lien: (mois: string) => string;
}) {
  const max = Math.max(...mois.map((m) => totaux[m]), 0);

  return (
    <figure className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">Charges des douze derniers mois</span>
        <span className="text-xs text-[var(--encre-faible)]">FCFA · cliquez un mois pour l&apos;ouvrir</span>
      </figcaption>
      <div className="flex h-40 items-end gap-[2px] border-b border-[var(--filet)] sm:gap-1">
        {mois.map((m) => {
          const valeur = totaux[m];
          // Hauteur en pourcentage de la plus forte : un affichage, pas un montant.
          const hauteur = max > 0 ? Math.max((valeur / max) * 100, valeur > 0 ? 2 : 0) : 0;
          const actif = m === choisi;
          return (
            <Link
              key={m}
              href={lien(m)}
              scroll={false}
              aria-label={`${libelleMois(m)} : ${fmt(valeur)} FCFA`}
              aria-current={actif ? "true" : undefined}
              className="group relative flex h-full flex-1 items-end justify-center rounded-t outline-none focus-visible:ring-2 focus-visible:ring-marque-500"
            >
              <span
                className={`block w-full max-w-10 rounded-t ${actif ? "bg-marque-600" : "bg-marque-300 group-hover:bg-marque-500"}`}
                style={{ height: `${hauteur}%` }}
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border border-[var(--filet)] bg-[var(--surface)] px-2 py-1 text-xs shadow-sm group-hover:block group-focus-visible:block"
              >
                <span className="block text-[var(--encre-faible)] first-letter:uppercase">{libelleMois(m)}</span>
                <span className="chiffres font-semibold text-[var(--encre)]">{fmt(valeur)} F</span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px] sm:gap-1" aria-hidden>
        {mois.map((m) => (
          <span key={m} className={`flex-1 text-center text-[10px] sm:text-[11px] ${m === choisi ? "font-semibold text-[var(--encre)]" : "text-[var(--encre-faible)]"}`}>
            {COURT[Number(m.slice(5)) - 1]}
          </span>
        ))}
      </div>
      <div className="mt-0.5 hidden gap-1 sm:flex" aria-hidden>
        {mois.map((m) => (
          <span key={m} className="chiffres flex-1 text-center text-[10px] text-[var(--encre-faible)]">
            {totaux[m] ? fmtCompact(totaux[m]) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
