"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { cloturerGuichet } from "@/modules/monnaie/actions";
import { NOM_RESEAU, rapprocher, RESEAUX, type Soldes } from "@/modules/monnaie/calcul";
import type { Reseau } from "@/modules/monnaie/schema";

const entierOuNul = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/[\s  ]/g, "")) || 0)));

function ton(ecart: number) {
  if (ecart === 0) return { fond: "bg-valide-50", texte: "text-valide-600" };
  if (Math.abs(ecart) <= 1000) return { fond: "bg-alerte-50", texte: "text-alerte-600" };
  return { fond: "bg-danger-50", texte: "text-danger-600" };
}

const signe = (n: number) => (n > 0 ? "+ " : n < 0 ? "− " : "");

/**
 * Clôture du guichet.
 *
 * L'agent compte son tiroir et relève le solde de chaque réseau. Tout le reste
 * se déduit des opérations. L'écart d'espèces passe en charge ou en produit ;
 * un écart de float signale une opération oubliée, à retrouver.
 */
export function Rapprochement({
  soldes,
  fondCaisse,
  volumes,
  ouvertures,
  autorise,
}: {
  soldes: Soldes;
  fondCaisse: number;
  volumes: { entrees: number; sorties: number };
  ouvertures: Record<Reseau, number>;
  autorise: boolean;
}) {
  const op = useOperation();
  const [comptees, setComptees] = useState("");
  const [releves, setReleves] = useState<Record<Reseau, string>>(
    Object.fromEntries(RESEAUX.map((r) => [r, ""])) as Record<Reseau, string>,
  );
  const [observations, setObservations] = useState("");

  const especes = entierOuNul(comptees);
  const r = rapprocher(
    soldes,
    especes ?? 0,
    Object.fromEntries(RESEAUX.map((x) => [x, entierOuNul(releves[x])])),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="text-base font-semibold">Espèces</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Fond de caisse</dt>
            <dd className="chiffres">{fmt(fondCaisse)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Reçu (dépôts, crédit, déstockage)</dt>
            <dd className="chiffres text-valide-600">+ {fmt(volumes.entrees)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Remis (retraits, approvisionnements)</dt>
            <dd className="chiffres text-danger-600">− {fmt(volumes.sorties)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[var(--filet)] pt-2">
            <dt className="font-semibold">Attendu en caisse</dt>
            <dd className="chiffres text-lg font-bold">{fmt(r.especesAttendues)}</dd>
          </div>
        </dl>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">Espèces comptées dans le tiroir</span>
          <input
            value={comptees}
            onChange={(e) => setComptees(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="chiffres h-touche w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-right text-xl font-bold outline-none focus:border-marque-500"
          />
        </label>

        {especes !== null && (
          <div className={`mt-3 rounded-lg px-4 py-3 ${ton(r.ecartEspeces).fond}`}>
            <p className={`text-xs font-medium ${ton(r.ecartEspeces).texte}`}>
              {r.ecartEspeces === 0 ? "Caisse juste" : r.ecartEspeces > 0 ? "Excédent de caisse" : "Manquant en caisse"}
            </p>
            <p className={`chiffres text-2xl font-bold ${ton(r.ecartEspeces).texte}`}>
              {signe(r.ecartEspeces)}
              {fmt(Math.abs(r.ecartEspeces))}
            </p>
          </div>
        )}

        <p className="mt-3 text-xs text-[var(--encre-faible)]">
          Commissions de la session : <span className="chiffres font-semibold text-valide-600">{fmt(soldes.commissions)} F</span>,
          dues par les opérateurs — elles ne sont pas dans le tiroir.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="text-base font-semibold">Float par réseau</h2>
        <p className="mt-0.5 text-xs text-[var(--encre-faible)]">Relevez le solde affiché par chaque opérateur</p>

        <ul className="mt-3 divide-y divide-[var(--filet)]">
          {r.floats.map((f) => (
            <li key={f.reseau} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{NOM_RESEAU[f.reseau]}</span>
                <span className="chiffres block text-xs text-[var(--encre-faible)]">
                  Ouverture {fmt(ouvertures[f.reseau])} · attendu {fmt(f.attendu)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <input
                  value={releves[f.reseau]}
                  onChange={(e) => setReleves((x) => ({ ...x, [f.reseau]: e.target.value }))}
                  inputMode="numeric"
                  placeholder="Relevé"
                  aria-label={`Solde relevé ${NOM_RESEAU[f.reseau]}`}
                  className={`${CLASSE_CHAMP} chiffres h-9 w-32 text-right`}
                />
                {f.ecart !== null && (
                  <span className={`chiffres text-xs font-semibold ${ton(f.ecart).texte}`}>
                    {f.ecart === 0 ? "Juste" : `${signe(f.ecart)}${fmt(Math.abs(f.ecart))}`}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 rounded-lg bg-[var(--surface-creuse)] px-3 py-2.5 text-xs text-[var(--encre-douce)]">
          Ce que le float perd, la caisse le gagne. Un écart sur un réseau sans écart inverse en caisse signale une
          opération non enregistrée : retrouvez-la dans l&apos;historique de l&apos;opérateur et saisissez-la avant de clôturer.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">Observations</span>
          <input value={observations} onChange={(e) => setObservations(e.target.value)} className={CLASSE_CHAMP} />
        </label>

        <button
          type="button"
          disabled={!autorise || especes === null || op.enCours}
          onClick={() =>
            op.lancer(() =>
              cloturerGuichet({
                especesComptees: especes,
                releves: Object.fromEntries(RESEAUX.map((x) => [x, entierOuNul(releves[x])])),
                observations: observations || undefined,
              }),
            )
          }
          className="sans-selection mt-4 h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-40"
        >
          {autorise ? "Clôturer la session" : "Votre rôle ne permet pas de clôturer"}
        </button>
        {op.resultat && <Retour resultat={op.resultat} />}
      </section>
    </div>
  );
}
