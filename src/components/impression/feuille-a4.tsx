import type { ReactNode } from "react";

/**
 * Une feuille A4 (210 × 297 mm), telle qu'elle sort de l'imprimante.
 *
 * Elle s'affiche dans l'application, au milieu de l'écran, et s'imprime seule :
 * la coque de gestion masque menu, barre du haut et bandeaux à l'impression.
 * La page est réglée en A4 portrait sans marge d'imprimante — les marges de la
 * feuille en tiennent lieu. Un document plus long que la feuille continue sur
 * la suivante ; `pied` descend au bas de la dernière.
 */
export function FeuilleA4({ children, pied }: { children: ReactNode; pied?: ReactNode }) {
  return (
    <article
      id="document-imprimable"
      className="mx-auto flex min-h-[297mm] w-[210mm] flex-col bg-white px-[14mm] py-[12mm] text-[10.5pt] leading-snug text-black shadow-lg print:min-h-[296mm] print:shadow-none"
    >
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
      {children}
      {pied && <div className="mt-auto">{pied}</div>}
    </article>
  );
}

/** Le fond de l'aperçu : la feuille posée sur un plateau, qui défile de côté sur téléphone. */
export function ApercuA4({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-3 overflow-x-auto bg-[var(--surface-creuse)] px-3 py-5 sm:rounded-xl print:m-0 print:overflow-visible print:bg-white print:p-0">
      <div className="w-fit min-w-full">{children}</div>
    </div>
  );
}
