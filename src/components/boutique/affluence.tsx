import { fmt, fmtEntier } from "@/lib/format";
import type { Heure } from "@/modules/boutique/calcul";

/**
 * Affluence de la journée : une barre par heure, hauteur = nombre de tickets.
 *
 * Une seule série, donc ni légende ni seconde couleur : le titre la nomme. La
 * valeur exacte s'affiche au survol et au focus, et le tableau caché la donne
 * aux lecteurs d'écran. Les heures vides restent visibles comme un creux — la
 * pause de midi se voit, c'est ce qu'on cherche.
 */
export function Affluence({ heures }: { heures: Heure[] }) {
  const max = Math.max(1, ...heures.map((h) => h.tickets));

  return (
    <figure className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">Tickets par heure</span>
        <span className="text-xs text-[var(--encre-faible)]">Heure d&apos;Abidjan</span>
      </figcaption>

      <div className="flex h-40 items-end gap-[2px] border-b border-[var(--filet)]" aria-hidden>
        {heures.map((h) => (
          <div key={h.heure} className="group relative flex h-full flex-1 items-end">
            {/* Cible de survol sur toute la hauteur : une barre basse reste facile à viser. */}
            <div
              className="mx-auto w-[70%] max-w-8 rounded-t-[4px] bg-marque-600 transition-opacity group-hover:opacity-80"
              style={{ height: h.tickets === 0 ? 0 : `${Math.max(2, (h.tickets / max) * 100)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-2.5 py-1.5 text-xs shadow-md group-hover:block">
              <p className="font-semibold">
                {h.heure} h – {h.heure + 1} h
              </p>
              <p className="chiffres text-[var(--encre-douce)]">
                {fmtEntier(h.tickets)} ticket{h.tickets > 1 ? "s" : ""} · {fmt(h.montant)} F
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]" aria-hidden>
        {heures.map((h) => (
          <span key={h.heure} className="chiffres flex-1 text-center text-[10px] text-[var(--encre-faible)]">
            {h.heure % 2 === 0 ? h.heure : ""}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Tickets et chiffre d&apos;affaires par heure</caption>
        <thead>
          <tr>
            <th>Heure</th>
            <th>Tickets</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          {heures.map((h) => (
            <tr key={h.heure}>
              <td>{h.heure} h</td>
              <td>{h.tickets}</td>
              <td>{fmt(h.montant)} F</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
