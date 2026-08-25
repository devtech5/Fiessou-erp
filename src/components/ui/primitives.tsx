import type { ReactNode } from "react";

/** Indicateur de tête. Une valeur, son libellé, une précision facultative. */
export function CarteIndicateur({
  libelle,
  valeur,
  unite,
  precision,
  ton = "neutre",
}: {
  libelle: string;
  valeur: string;
  unite?: string;
  precision?: string;
  ton?: "neutre" | "marque" | "alerte" | "danger" | "valide";
}) {
  const tons = {
    neutre: "text-[var(--encre)]",
    marque: "text-marque-600",
    alerte: "text-alerte-600",
    danger: "text-danger-600",
    valide: "text-valide-600",
  } as const;

  return (
    <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
      <p className="text-xs font-medium text-[var(--encre-faible)]">{libelle}</p>
      <p className={`chiffres mt-1 text-2xl font-bold ${tons[ton]}`}>
        {valeur}
        {unite && (
          <span className="ml-1 text-sm font-medium text-[var(--encre-faible)]">
            {unite}
          </span>
        )}
      </p>
      {precision && (
        <p className="mt-0.5 text-xs text-[var(--encre-faible)]">{precision}</p>
      )}
    </div>
  );
}

export type TonPastille = "neutre" | "marque" | "valide" | "alerte" | "danger";

export function Pastille({
  ton = "neutre",
  children,
}: {
  ton?: TonPastille;
  children: ReactNode;
}) {
  // Chaque ton se définit par un couple fond/texte pris dans la même famille,
  // pour rester lisible sous les deux thèmes.
  const tons = {
    neutre: "bg-[var(--surface-creuse)] text-[var(--encre-douce)]",
    marque: "bg-marque-600 text-white",
    valide: "bg-valide-50 text-valide-600",
    alerte: "bg-alerte-50 text-alerte-600",
    danger: "bg-danger-50 text-danger-600",
  } as const;

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tons[ton]}`}
    >
      {children}
    </span>
  );
}

/** En-tête de page : titre, sous-titre, actions alignées à droite. */
export function EnTetePage({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{titre}</h1>
        {sousTitre && (
          <p className="mt-0.5 text-sm text-[var(--encre-douce)]">{sousTitre}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Conteneur de tableau. Le défilement horizontal reste interne : la page ne
 * doit jamais défiler latéralement, même sur un écran de 1024 px.
 */
export function Tableau({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  aligne = "gauche",
}: {
  children: ReactNode;
  aligne?: "gauche" | "droite";
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-[var(--filet)] bg-[var(--surface-creuse)] px-3.5 py-2.5 text-xs font-semibold text-[var(--encre-faible)] ${
        aligne === "droite" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  aligne = "gauche",
  chiffres = false,
  fort = false,
}: {
  children: ReactNode;
  aligne?: "gauche" | "droite";
  chiffres?: boolean;
  fort?: boolean;
}) {
  return (
    <td
      className={`border-b border-[var(--filet)] px-3.5 py-2.5 ${
        aligne === "droite" ? "text-right" : "text-left"
      } ${chiffres ? "chiffres" : ""} ${fort ? "font-semibold" : ""}`}
    >
      {children}
    </td>
  );
}

export function BoutonSecondaire({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]"
    >
      {children}
    </button>
  );
}

export function BoutonPrincipal({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white hover:bg-marque-700"
    >
      {children}
    </button>
  );
}
