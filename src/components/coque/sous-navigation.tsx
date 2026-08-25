"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface EntreeNav {
  href: string;
  libelle: string;
}

/**
 * Onglets d'un module, sous le fil d'Ariane.
 *
 * Cinq entrées au maximum, sans exception. Le concurrent empile un onglet par
 * fonctionnalité ajoutée — vingt-sept en comptabilité, treize en stock, dont
 * un doublon « Alertes » / « Alertes stock ». Passé une dizaine, plus personne
 * ne lit la barre : on cherche au hasard. Une fonction qui n'a pas sa place
 * dans les cinq entrées appartient à l'écran d'une autre, pas à un onglet de
 * plus.
 */
export function SousNavigation({ entrees }: { entrees: EntreeNav[] }) {
  const chemin = usePathname();

  return (
    <nav
      aria-label="Sections du module"
      className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--filet)] pb-2"
    >
      {entrees.map((entree) => {
        const actif = chemin === entree.href;
        return (
          <Link
            key={entree.href}
            href={entree.href}
            aria-current={actif ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              actif
                ? "bg-[var(--surface-creuse)] text-[var(--encre)]"
                : "text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]"
            }`}
          >
            {entree.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
