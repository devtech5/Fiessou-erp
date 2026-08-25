"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation de Fiessou.
 *
 * Contrainte tenue volontairement : au plus cinq entrées par module.
 *
 * Le concurrent empile un onglet par fonctionnalité ajoutée — vingt-sept en
 * comptabilité, treize en stock, dont un doublon « Alertes » / « Alertes
 * stock ». Passé une dizaine d'entrées, plus personne ne lit la barre : on
 * cherche au hasard. Une fonction qui n'a pas sa place dans les cinq entrées
 * appartient à l'écran d'une autre, pas à un onglet de plus.
 */

export interface EntreeNav {
  href: string;
  libelle: string;
}

const MODULES: (EntreeNav & { racine: string })[] = [
  { href: "/stock", racine: "/stock", libelle: "Stock" },
  { href: "/commercial", racine: "/commercial", libelle: "Commercial" },
  { href: "/comptabilite", racine: "/comptabilite", libelle: "Comptabilité" },
  { href: "/rh", racine: "/rh", libelle: "Personnel" },
  { href: "/actifs", racine: "/actifs", libelle: "Actifs" },
  { href: "/monnaie", racine: "/monnaie", libelle: "Guichet" },
];

export function NavigationModules() {
  const chemin = usePathname();

  return (
    <nav
      aria-label="Modules"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--filet)] bg-[var(--surface)] px-3 py-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:px-2.5 lg:py-3"
    >
      <div className="mb-1 hidden px-2 lg:block">
        <span className="text-sm font-bold tracking-tight">Fiessou</span>
      </div>

      {MODULES.map((module) => {
        const actif = chemin.startsWith(module.racine);
        return (
          <Link
            key={module.href}
            href={module.href}
            aria-current={actif ? "page" : undefined}
            className={`h-cible flex shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium lg:w-40 ${
              actif
                ? "bg-marque-600 text-white"
                : "text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]"
            }`}
          >
            {module.libelle}
          </Link>
        );
      })}

      <div className="ml-auto lg:ml-0 lg:mt-auto lg:pt-3">
        <Link
          href="/caisse"
          className="h-cible flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-marque-600 px-3 text-sm font-semibold text-marque-600 hover:bg-marque-600 hover:text-white lg:w-40"
        >
          Ouvrir la caisse
        </Link>
      </div>
    </nav>
  );
}

/** Sous-navigation d'un module. Cinq entrées maximum, sans exception. */
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
