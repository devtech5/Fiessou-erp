"use client";

import { useState } from "react";

import { fmt } from "@/lib/format";
import {
  FOND_DE_CAISSE,
  RESEAUX,
  rapprochement,
  totauxJournee,
} from "@/lib/fixtures/monnaie";

/**
 * Clôture du guichet.
 *
 * L'agent compte son tiroir et saisit le montant. Tout le reste se déduit :
 * fond de caisse d'ouverture, plus les espèces reçues, moins celles remises,
 * plus les commissions encaissées.
 *
 * L'écart est le seul chiffre qui compte. Un guichet qui ne rapproche pas son
 * float et ses espèces chaque soir découvre les manquants des semaines plus
 * tard, quand plus personne ne peut dire d'où ils viennent.
 */
export function Rapprochement() {
  const [comptees, setComptees] = useState<number | null>(null);
  const t = totauxJournee();
  const r = rapprochement(comptees ?? 0);

  const saisi = comptees !== null;
  const ecartNul = r.ecart === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* -------------------------------------------------------- espèces */}
      <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="text-base font-semibold">Espèces</h2>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Fond de caisse</dt>
            <dd className="chiffres">{fmt(FOND_DE_CAISSE)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">
              Reçu des clients ({t.nbDepots} dépôts)
            </dt>
            <dd className="chiffres text-valide-600">+ {fmt(t.volumeDepots)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">
              Remis aux clients ({t.nbRetraits} retraits)
            </dt>
            <dd className="chiffres text-danger-600">− {fmt(t.volumeRetraits)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Crédit vendu</dt>
            <dd className="chiffres text-valide-600">+ {fmt(t.volumeCredits)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Commissions</dt>
            <dd className="chiffres text-valide-600">+ {fmt(t.commissions)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[var(--filet)] pt-2">
            <dt className="font-semibold">Attendu en caisse</dt>
            <dd className="chiffres text-lg font-bold">{fmt(r.especesAttendues)}</dd>
          </div>
        </dl>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
            Espèces comptées dans le tiroir
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              value={comptees ?? ""}
              onChange={(e) =>
                setComptees(
                  e.target.value === ""
                    ? null
                    : Math.max(0, Math.round(Number(e.target.value) || 0)),
                )
              }
              placeholder="0"
              className="chiffres h-touche w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-right text-xl font-bold outline-none focus:border-marque-500"
            />
            <span className="shrink-0 text-sm text-[var(--encre-faible)]">FCFA</span>
          </div>
        </label>

        {saisi && (
          <div
            className={`mt-3 rounded-lg px-4 py-3 ${
              ecartNul
                ? "bg-valide-50"
                : Math.abs(r.ecart) <= 1000
                  ? "bg-alerte-50"
                  : "bg-danger-50"
            }`}
          >
            <p
              className={`text-xs font-medium ${
                ecartNul
                  ? "text-valide-600"
                  : Math.abs(r.ecart) <= 1000
                    ? "text-alerte-600"
                    : "text-danger-600"
              }`}
            >
              {ecartNul
                ? "Caisse juste"
                : r.ecart > 0
                  ? "Excédent de caisse"
                  : "Manquant en caisse"}
            </p>
            <p
              className={`chiffres text-2xl font-bold ${
                ecartNul
                  ? "text-valide-600"
                  : Math.abs(r.ecart) <= 1000
                    ? "text-alerte-600"
                    : "text-danger-600"
              }`}
            >
              {r.ecart > 0 ? "+" : r.ecart < 0 ? "−" : ""} {fmt(Math.abs(r.ecart))}
            </p>
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------- float */}
      <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="text-base font-semibold">Float par réseau</h2>
        <p className="mt-0.5 text-xs text-[var(--encre-faible)]">
          À confronter aux soldes affichés par chaque opérateur
        </p>

        <ul className="mt-3 divide-y divide-[var(--filet)]">
          {RESEAUX.map((reseau) => {
            const variation = reseau.float - reseau.floatOuverture;
            return (
              <li key={reseau.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{reseau.nom}</span>
                  <span className="chiffres block text-xs text-[var(--encre-faible)]">
                    Ouverture {fmt(reseau.floatOuverture)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="chiffres block text-sm font-bold">
                    {fmt(reseau.float)}
                  </span>
                  <span
                    className={`chiffres block text-xs ${
                      variation >= 0 ? "text-valide-600" : "text-danger-600"
                    }`}
                  >
                    {variation >= 0 ? "+" : "−"} {fmt(Math.abs(variation))}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <dl className="mt-3 space-y-2 border-t border-[var(--filet)] pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Float à l&apos;ouverture</dt>
            <dd className="chiffres">{fmt(r.floatOuverture)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold">Float actuel</dt>
            <dd className="chiffres text-lg font-bold">{fmt(r.floatActuel)}</dd>
          </div>
        </dl>

        <p className="mt-3 rounded-lg bg-[var(--surface-creuse)] px-3 py-2.5 text-xs text-[var(--encre-douce)]">
          Hors commissions, ce que le float perd, la caisse le gagne. Un écart sur
          l&apos;un sans écart correspondant sur l&apos;autre signale une opération
          non enregistrée.
        </p>
      </section>
    </div>
  );
}
