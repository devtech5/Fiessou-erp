"use client";

import { useState } from "react";

import { Pastille, type TonPastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import {
  LIBELLE_NATURE,
  LIBELLE_PREUVE,
  LIBELLE_STATUT,
  MISSIONS,
  avancement,
  type MissionDemo,
  type StatutMission,
} from "@/lib/fixtures/missions";

const TON: Record<StatutMission, TonPastille> = {
  planifiee: "neutre",
  en_cours: "marque",
  terminee: "valide",
  echouee: "danger",
  annulee: "neutre",
};

/**
 * Fil d'une mission : les étapes dans l'ordre, avec la preuve attachée à
 * chacune.
 *
 * La preuve est le point du module. Une livraison contestée, une réserve de
 * chantier ou un relevé de terrain ne valent que par ce qui les atteste :
 * photo, position, signature, horodatage. Sans cela, il ne reste qu'une case
 * cochée, et une case cochée ne tranche aucun litige.
 */
export function FilMission() {
  const [selection, setSelection] = useState<MissionDemo>(MISSIONS[0]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
      {/* ---------------------------------------------------- la liste */}
      <ul className="h-fit divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
        {MISSIONS.map((mission) => {
          const actif = selection.id === mission.id;
          return (
            <li key={mission.id}>
              <button
                type="button"
                onClick={() => setSelection(mission)}
                aria-current={actif ? "true" : undefined}
                className={`w-full px-4 py-3 text-left ${
                  actif
                    ? "bg-[var(--surface-creuse)]"
                    : "hover:bg-[var(--surface-creuse)]"
                }`}
              >
                <span className="chiffres block text-xs text-[var(--encre-faible)]">
                  {mission.reference}
                </span>
                <span className="block truncate text-sm font-medium">
                  {mission.titre}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <Pastille ton={TON[mission.statut]}>
                    {LIBELLE_STATUT[mission.statut]}
                  </Pastille>
                  {mission.enAttenteSynchro > 0 && (
                    <Pastille ton="alerte">{mission.enAttenteSynchro}</Pastille>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* ----------------------------------------------------- le détail */}
      <section className="min-w-0 rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
        <header className="border-b border-[var(--filet)] p-4">
          <p className="chiffres text-xs text-[var(--encre-faible)]">
            {selection.reference} · {LIBELLE_NATURE[selection.nature]}
          </p>
          <h2 className="mt-0.5 text-lg font-bold">{selection.titre}</h2>

          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--encre-faible)]">Assignée à</dt>
              <dd className="font-medium">{selection.assigneA}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--encre-faible)]">Lieu</dt>
              <dd className="truncate text-right">{selection.lieu}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--encre-faible)]">Échéance</dt>
              <dd className="chiffres">{selection.echeance}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--encre-faible)]">Avancement</dt>
              <dd className="chiffres font-semibold">{avancement(selection)} %</dd>
            </div>
            {selection.client && (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--encre-faible)]">Client</dt>
                <dd className="truncate text-right">{selection.client}</dd>
              </div>
            )}
            {selection.montant && (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--encre-faible)]">Montant</dt>
                <dd className="chiffres font-semibold">
                  {fmt(selection.montant)} FCFA
                </dd>
              </div>
            )}
          </dl>
        </header>

        {selection.enAttenteSynchro > 0 && (
          <p className="border-b border-[var(--filet)] bg-alerte-50 px-4 py-2.5 text-xs font-medium text-alerte-600">
            {selection.enAttenteSynchro} preuve
            {selection.enAttenteSynchro > 1 ? "s" : ""} encore sur l&apos;appareil
            de {selection.assigneA}. Elles remonteront au retour du réseau.
          </p>
        )}

        <ol className="p-4">
          {selection.etapes.map((etape, index) => {
            const derniere = index === selection.etapes.length - 1;
            return (
              <li key={index} className="relative flex gap-3 pb-5 last:pb-0">
                {/* Trait de liaison entre les jalons du fil. */}
                {!derniere && (
                  <span
                    className="absolute left-[11px] top-6 h-full w-px bg-[var(--filet)]"
                    aria-hidden
                  />
                )}

                <span
                  className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    etape.faite
                      ? "bg-valide-500 text-white"
                      : "border border-[var(--filet)] bg-[var(--surface)] text-[var(--encre-faible)]"
                  }`}
                  aria-hidden
                >
                  {etape.faite ? "✓" : index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p
                      className={`text-sm font-medium ${
                        etape.faite ? "" : "text-[var(--encre-faible)]"
                      }`}
                    >
                      {etape.libelle}
                    </p>
                    {etape.heure && (
                      <span className="chiffres shrink-0 text-xs text-[var(--encre-faible)]">
                        {etape.heure}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {etape.preuves.map((preuve) => (
                      <Pastille key={preuve} ton={etape.faite ? "valide" : "neutre"}>
                        {LIBELLE_PREUVE[preuve]}
                        {etape.faite ? "" : " attendue"}
                      </Pastille>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
