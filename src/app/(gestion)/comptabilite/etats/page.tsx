import type { Metadata } from "next";

import { BoutonSecondaire, EnTetePage } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { CLASSES, calculerSIG } from "@/lib/fixtures/comptabilite";

export const metadata: Metadata = { title: "États financiers" };

export default function PageEtats() {
  const sig = calculerSIG();

  return (
    <>
      <EnTetePage
        titre="États financiers"
        sousTitre="Compte de résultat SYSCOHADA · exercice 2026"
        actions={
          <>
            <BoutonSecondaire>Export PDF</BoutonSecondaire>
            <BoutonSecondaire>Export Excel</BoutonSecondaire>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <section className="overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
          <header className="border-b border-[var(--filet)] px-4 py-3">
            <h2 className="text-sm font-semibold">Soldes intermédiaires de gestion</h2>
            <p className="text-xs text-[var(--encre-faible)]">
              Chaque solde découle du précédent
            </p>
          </header>

          <table className="w-full text-sm">
            <tbody>
              {sig.map((solde) => (
                <tr
                  key={solde.code}
                  className={`border-b border-[var(--filet)] last:border-b-0 ${
                    solde.cle ? "bg-[var(--surface-creuse)]" : ""
                  }`}
                >
                  <td className="chiffres w-12 py-2.5 pl-4 text-xs text-[var(--encre-faible)]">
                    {solde.code}
                  </td>
                  <td
                    className={`py-2.5 pr-3 ${solde.cle ? "font-semibold" : "text-[var(--encre-douce)]"}`}
                  >
                    {solde.libelle}
                  </td>
                  <td
                    className={`chiffres py-2.5 pr-4 text-right ${
                      solde.cle ? "text-base font-bold" : ""
                    } ${solde.montant < 0 && !solde.cle ? "text-[var(--encre-faible)]" : ""} ${
                      solde.cle && solde.montant < 0 ? "text-danger-600" : ""
                    }`}
                  >
                    {solde.montant < 0 ? `(${fmt(Math.abs(solde.montant))})` : fmt(solde.montant)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="border-t border-[var(--filet)] px-4 py-2.5 text-xs text-[var(--encre-faible)]">
            Montants en francs CFA. Les charges figurent entre parenthèses.
          </p>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <h2 className="mb-2.5 text-sm font-semibold">Plan comptable</h2>
            <ul className="space-y-1.5 text-sm">
              {CLASSES.map((classe) => (
                <li key={classe.numero} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[var(--encre-douce)]">
                    <span className="chiffres mr-1.5 text-xs text-[var(--encre-faible)]">
                      {classe.numero}
                    </span>
                    {classe.intitule}
                  </span>
                  <span className="chiffres shrink-0 text-xs text-[var(--encre-faible)]">
                    {classe.comptes}
                  </span>
                </li>
              ))}
            </ul>
            <p className="chiffres mt-3 border-t border-[var(--filet)] pt-2.5 text-sm font-semibold">
              {CLASSES.reduce((somme, c) => somme + c.comptes, 0)} comptes
            </p>
          </section>

          <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <h2 className="mb-2 text-sm font-semibold">États disponibles</h2>
            <ul className="space-y-1.5 text-sm text-[var(--encre-douce)]">
              <li>Bilan — actif et passif</li>
              <li>Compte de résultat</li>
              <li>Tableau de flux de trésorerie</li>
              <li>Notes annexes</li>
              <li>Grand livre et balance</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
