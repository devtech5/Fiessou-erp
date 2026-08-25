"use client";

import { useMemo, useState } from "react";

import { BoutonPrincipal, Pastille, type TonPastille } from "@/components/ui/primitives";
import {
  ecritureAvoir,
  ecritureFacture,
  estEquilibree,
  totalCredit,
  totalDebit,
  type Ecriture,
} from "@/lib/comptabilite/ecritures";
import { fmt } from "@/lib/format";
import {
  DOCUMENTS,
  LIBELLE_STATUT,
  comptabilisable,
  totalHT,
  totalTTC,
  totalTVA,
  type DocumentDemo,
  type StatutDocument,
} from "@/lib/fixtures/gestion";

const TON: Record<StatutDocument, TonPastille> = {
  brouillon: "neutre",
  envoye: "marque",
  paye: "valide",
  en_retard: "danger",
  accepte: "valide",
  refuse: "danger",
  converti: "valide",
};

const NATURE = { facture: "Facture", devis: "Devis", avoir: "Avoir" } as const;

/**
 * Pièces commerciales et écriture comptable associée.
 *
 * Le pont entre les deux modules se voit ici : sélectionner une facture montre
 * l'écriture qu'elle produit, avant qu'elle ne soit passée. Sans cet aperçu,
 * comptabiliser reviendrait à signer sans lire — et une écriture fausse ne se
 * découvre qu'à la clôture, des mois plus tard.
 *
 * L'écriture est CALCULÉE à l'affichage, jamais stockée à côté de la pièce.
 * Une écriture figée pendant que sa facture change laisserait les deux
 * diverger sans que rien ne le signale.
 */
export function EcriturePiece() {
  const [selection, setSelection] = useState<DocumentDemo>(DOCUMENTS[0]);

  const ecriture = useMemo<Ecriture | { erreur: string }>(() => {
    if (!comptabilisable(selection)) {
      return {
        erreur:
          selection.nature === "devis"
            ? "Un devis n'engage rien tant qu'il n'est pas accepté : il ne produit aucune écriture."
            : "Une pièce en brouillon ou refusée ne se comptabilise pas.",
      };
    }

    const piece = {
      numero: selection.numero,
      date: selection.date,
      client: selection.client,
      compteAuxiliaire: selection.compteAuxiliaire,
      lignes: selection.lignes,
    };

    try {
      return selection.nature === "avoir"
        ? ecritureAvoir(piece)
        : ecritureFacture(piece);
    } catch (erreur) {
      // Le moteur refuse de produire une écriture déséquilibrée. Le dire ici
      // plutôt que d'afficher un tableau faux.
      return { erreur: erreur instanceof Error ? erreur.message : String(erreur) };
    }
  }, [selection]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
      {/* --------------------------------------------------- les pièces */}
      <ul className="h-fit divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
        {DOCUMENTS.map((document) => {
          const actif = selection.id === document.id;
          return (
            <li key={document.id}>
              <button
                type="button"
                onClick={() => setSelection(document)}
                aria-current={actif ? "true" : undefined}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                  actif
                    ? "bg-[var(--surface-creuse)]"
                    : "hover:bg-[var(--surface-creuse)]"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="chiffres block text-xs text-[var(--encre-faible)]">
                    {document.numero} · {NATURE[document.nature]}
                  </span>
                  <span className="block truncate text-sm font-medium">
                    {document.client}
                  </span>
                  <span className="chiffres block text-xs text-[var(--encre-faible)]">
                    {document.date}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="chiffres block text-sm font-bold">
                    {document.nature === "avoir" ? "− " : ""}
                    {fmt(totalTTC(document))}
                  </span>
                  <span className="mt-1 flex items-center justify-end gap-1.5">
                    <Pastille ton={TON[document.statut]}>
                      {LIBELLE_STATUT[document.statut]}
                    </Pastille>
                    {/* L'état comptable est distinct de l'état commercial :
                        une facture envoyée peut n'être pas encore passée. */}
                    {comptabilisable(document) && (
                      <Pastille ton={document.comptabiliseLe ? "valide" : "alerte"}>
                        {document.comptabiliseLe ? "comptabilisée" : "à passer"}
                      </Pastille>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* ------------------------------------------------- l'écriture */}
      <aside className="h-fit rounded-xl border border-[var(--filet)] bg-[var(--surface)] lg:sticky lg:top-6">
        <header className="border-b border-[var(--filet)] p-4">
          <p className="chiffres text-xs text-[var(--encre-faible)]">
            {selection.numero}
          </p>
          <h2 className="text-base font-semibold">{selection.client}</h2>

          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--encre-faible)]">Total hors taxes</dt>
              <dd className="chiffres">{fmt(totalHT(selection))}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--encre-faible)]">TVA</dt>
              <dd className="chiffres">{fmt(totalTVA(selection))}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-[var(--filet)] pt-1">
              <dt className="font-semibold">Total à payer</dt>
              <dd className="chiffres font-bold">{fmt(totalTTC(selection))}</dd>
            </div>
          </dl>
        </header>

        <div className="p-4">
          <h3 className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">
            Écriture générée
          </h3>

          {"erreur" in ecriture ? (
            <p className="rounded-lg bg-[var(--surface-creuse)] px-3 py-2.5 text-sm text-[var(--encre-douce)]">
              {ecriture.erreur}
            </p>
          ) : (
            <>
              <p className="chiffres mb-2 text-xs text-[var(--encre-faible)]">
                Journal {ecriture.journal} · {ecriture.libelle}
              </p>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--filet)]">
                    <th className="pb-1.5 text-left text-xs font-semibold text-[var(--encre-faible)]">
                      Compte
                    </th>
                    <th className="pb-1.5 text-right text-xs font-semibold text-[var(--encre-faible)]">
                      Débit
                    </th>
                    <th className="pb-1.5 text-right text-xs font-semibold text-[var(--encre-faible)]">
                      Crédit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ecriture.lignes.map((l, index) => (
                    <tr key={index} className="border-b border-[var(--filet)]">
                      <td className="py-2 pr-2">
                        <span className="chiffres text-xs font-semibold">
                          {l.compte}
                          {l.auxiliaire && (
                            <span className="font-normal text-[var(--encre-faible)]">
                              {" "}
                              {l.auxiliaire}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-[var(--encre-faible)]">
                          {l.libelleCompte}
                        </span>
                      </td>
                      <td className="chiffres py-2 text-right">
                        {l.debit > 0 ? fmt(l.debit) : "—"}
                      </td>
                      <td className="chiffres py-2 text-right">
                        {l.credit > 0 ? fmt(l.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 text-xs font-semibold">Totaux</td>
                    <td className="chiffres py-2 text-right font-bold">
                      {fmt(totalDebit(ecriture))}
                    </td>
                    <td className="chiffres py-2 text-right font-bold">
                      {fmt(totalCredit(ecriture))}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p
                className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
                  estEquilibree(ecriture)
                    ? "bg-valide-50 text-valide-600"
                    : "bg-danger-50 text-danger-600"
                }`}
              >
                {estEquilibree(ecriture)
                  ? "Équilibrée — débit égal au crédit"
                  : "Déséquilibrée — écriture refusée"}
              </p>

              <div className="mt-4">
                {selection.comptabiliseLe ? (
                  <p className="chiffres text-center text-xs text-[var(--encre-faible)]">
                    Passée le {selection.comptabiliseLe}
                  </p>
                ) : (
                  <BoutonPrincipal>Comptabiliser</BoutonPrincipal>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
