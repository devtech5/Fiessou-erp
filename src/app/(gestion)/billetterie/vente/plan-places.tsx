"use client";

import { useState } from "react";

import { BoutonPrincipal, Pastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import {
  DEPARTS,
  LETTRES_SIEGE,
  capacite,
  placesLibres,
  type DepartDemo,
} from "@/lib/fixtures/billetterie";

/**
 * Vente au plan de places.
 *
 * Le siège est la ressource, et il n'existe que pour ce départ précis : à
 * l'heure du départ, il disparaît. C'est ce qui sépare la billetterie de la
 * livraison, avec laquelle elle figurait côte à côte dans le périmètre.
 *
 * Un siège déjà vendu est visible mais inerte. Le laisser sélectionnable
 * produirait exactement ce que le plan sert à empêcher : deux passagers debout
 * devant le même numéro au moment de l'embarquement.
 */
export function PlanPlaces() {
  const ouverts = DEPARTS.filter(
    (d) => d.statut === "ouvert" || d.statut === "embarquement",
  );
  const [depart, setDepart] = useState<DepartDemo>(ouverts[0]);
  const [selection, setSelection] = useState<string[]>([]);

  function basculer(siege: string) {
    if (depart.siegesVendus.includes(siege)) return;
    setSelection((actuel) =>
      actuel.includes(siege)
        ? actuel.filter((s) => s !== siege)
        : [...actuel, siege],
    );
  }

  function changerDepart(nouveau: DepartDemo) {
    setDepart(nouveau);
    // La sélection ne survit pas au changement de départ : les numéros de siège
    // se ressemblent d'un véhicule à l'autre et n'ont rien à voir entre eux.
    setSelection([]);
  }

  const total = selection.length * depart.ligne.tarif;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      {/* ----------------------------------------------------- le plan */}
      <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">
            Départ
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ouverts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => changerDepart(d)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  depart.id === d.id
                    ? "border-marque-600 bg-marque-600 text-white"
                    : "border-[var(--filet)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                <span className="block font-semibold">
                  {d.ligne.depart} → {d.ligne.arrivee}
                </span>
                <span className="chiffres block text-xs opacity-80">
                  {d.date} · {d.heure} · {placesLibres(d)} libres
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-[var(--encre-faible)]">
          <span className="flex items-center gap-1.5">
            <span
              className="size-3.5 rounded bg-[var(--surface)] ring-1 ring-[var(--filet)]"
              aria-hidden
            />
            Libre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3.5 rounded bg-marque-600" aria-hidden />
            Sélectionné
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3.5 rounded bg-danger-50" aria-hidden />
            Vendu
          </span>
        </div>

        {/* Le repère avant du véhicule évite de vendre « devant » à quelqu'un
            qui se retrouve au fond. */}
        <p className="mb-2 rounded-lg bg-[var(--surface-creuse)] py-1.5 text-center text-xs font-semibold text-[var(--encre-faible)]">
          Avant du véhicule
        </p>

        <div className="overflow-x-auto">
          <ol className="mx-auto flex w-fit flex-col gap-1.5">
            {Array.from({ length: depart.rangees }, (_, r) => {
              const rangee = r + 1;
              return (
                <li key={rangee} className="flex items-center gap-1.5">
                  <span className="chiffres w-6 shrink-0 text-right text-xs text-[var(--encre-faible)]">
                    {rangee}
                  </span>

                  {LETTRES_SIEGE.map((lettre, index) => {
                    const siege = `${rangee}${lettre}`;
                    const vendu = depart.siegesVendus.includes(siege);
                    const choisi = selection.includes(siege);

                    return (
                      <span key={lettre} className="flex items-center">
                        <button
                          type="button"
                          disabled={vendu}
                          onClick={() => basculer(siege)}
                          aria-pressed={choisi}
                          aria-label={
                            vendu
                              ? `Siège ${siege}, déjà vendu`
                              : `Siège ${siege}, libre`
                          }
                          className={`sans-selection chiffres size-9 rounded-lg border text-xs font-semibold transition ${
                            vendu
                              ? "cursor-not-allowed border-transparent bg-danger-50 text-danger-600 opacity-70"
                              : choisi
                                ? "border-marque-600 bg-marque-600 text-white"
                                : "border-[var(--filet)] hover:border-marque-400 hover:bg-[var(--surface-creuse)]"
                          }`}
                        >
                          {lettre}
                        </button>
                        {/* Couloir central, entre B et C. */}
                        {index === 1 && <span className="w-6" aria-hidden />}
                      </span>
                    );
                  })}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* -------------------------------------------------- récapitulatif */}
      <aside className="h-fit rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 lg:sticky lg:top-6">
        <h2 className="text-base font-semibold">
          {depart.ligne.depart} → {depart.ligne.arrivee}
        </h2>
        <p className="chiffres mt-0.5 text-xs text-[var(--encre-faible)]">
          {depart.reference} · {depart.date} à {depart.heure}
        </p>

        <dl className="mt-3 space-y-2 border-t border-[var(--filet)] pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Tarif unitaire</dt>
            <dd className="chiffres font-semibold">{fmt(depart.ligne.tarif)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Places du véhicule</dt>
            <dd className="chiffres">{capacite(depart)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Encore libres</dt>
            <dd className="chiffres">{placesLibres(depart)}</dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-[var(--filet)] pt-3">
          <p className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">
            Sièges sélectionnés
          </p>

          {selection.length === 0 ? (
            <p className="text-sm text-[var(--encre-faible)]">
              Touchez un siège libre sur le plan.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selection.map((siege) => (
                <Pastille key={siege} ton="marque">
                  {siege}
                </Pastille>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--filet)] pt-3">
          <span className="text-sm font-semibold">Total</span>
          <span className="chiffres text-2xl font-bold">
            {fmt(total)}
            <span className="ml-1 text-sm font-medium text-[var(--encre-faible)]">
              FCFA
            </span>
          </span>
        </div>

        <div className="mt-4">
          <BoutonPrincipal>
            {selection.length === 0
              ? "Sélectionnez un siège"
              : `Émettre ${selection.length} billet${selection.length > 1 ? "s" : ""}`}
          </BoutonPrincipal>
        </div>
      </aside>
    </div>
  );
}
