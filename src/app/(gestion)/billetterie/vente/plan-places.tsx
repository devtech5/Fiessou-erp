"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP, Pastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { vendreBillets } from "@/modules/billetterie/actions";
import { capacite, comparerSieges, LETTRES_SIEGE } from "@/modules/billetterie/calcul";

export interface DepartEnVente {
  id: string;
  reference: string;
  trajet: string;
  partLe: string;
  rangees: number;
  tarif: number;
  statut: "ouvert" | "embarquement" | "parti" | "annule";
  occupes: string[];
}

interface Passager {
  nom: string;
  telephone: string;
  piece: string;
}

const MOMENT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * Vente au plan de places.
 *
 * Le siège est la ressource, et il n'existe que pour ce départ précis. Un
 * siège déjà vendu est visible mais inerte. Le serveur revérifie de toute
 * façon, départ verrouillé : un plan affiché il y a deux minutes peut avoir
 * vendu depuis à un autre guichet.
 */
export function PlanPlaces({ departs, vendre }: { departs: DepartEnVente[]; vendre: boolean }) {
  const [departId, setDepartId] = useState(departs[0].id);
  const [selection, setSelection] = useState<string[]>([]);
  const [passagers, setPassagers] = useState<Record<string, Passager>>({});
  const [moyen, setMoyen] = useState("especes");
  const op = useOperation();

  const depart = departs.find((d) => d.id === departId) ?? departs[0];
  const occupes = new Set(depart.occupes);
  const libres = capacite(depart.rangees) - occupes.size;

  function basculer(siege: string) {
    if (occupes.has(siege)) return;
    setSelection((actuel) =>
      actuel.includes(siege) ? actuel.filter((s) => s !== siege) : [...actuel, siege].sort(comparerSieges),
    );
  }

  function changerDepart(id: string) {
    setDepartId(id);
    // Les numéros de siège se ressemblent d'un véhicule à l'autre et n'ont
    // rien à voir entre eux : la sélection ne survit pas au changement.
    setSelection([]);
    setPassagers({});
  }

  function saisir(siege: string, champ: keyof Passager, valeur: string) {
    const vide: Passager = { nom: "", telephone: "", piece: "" };
    setPassagers((p) => ({ ...p, [siege]: { ...vide, ...p[siege], [champ]: valeur } }));
  }

  const complets = selection.every((s) => (passagers[s]?.nom ?? "").trim().length >= 2);
  const total = selection.length * depart.tarif;

  function emettre() {
    op.lancer(
      () =>
        vendreBillets({
          departId: depart.id,
          moyen,
          places: selection.map((siege) => ({
            siege,
            nom: passagers[siege]?.nom ?? "",
            telephone: passagers[siege]?.telephone || undefined,
            piece: passagers[siege]?.piece || undefined,
          })),
        }),
      () => {
        setSelection([]);
        setPassagers({});
      },
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="min-w-0 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <fieldset className="mb-4 min-w-0">
          <legend className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">Départ</legend>
          {/* Sur téléphone, les départs défilent à l'horizontale : empilés, ils
              repoussaient le plan de places hors de l'écran. */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
            {departs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => changerDepart(d.id)}
                aria-pressed={depart.id === d.id}
                className={`w-56 shrink-0 rounded-lg border px-3 py-2 text-left text-sm sm:w-auto ${
                  depart.id === d.id
                    ? "border-marque-600 bg-marque-600 text-white"
                    : "border-[var(--filet)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                <span className="block font-semibold">{d.trajet}</span>
                <span className="chiffres block text-xs opacity-80">
                  {MOMENT.format(new Date(d.partLe))} · {capacite(d.rangees) - d.occupes.length} libres
                  {d.statut === "embarquement" ? " · embarquement" : ""}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-[var(--encre-faible)]">
          <span className="flex items-center gap-1.5">
            <span className="size-3.5 rounded bg-[var(--surface)] ring-1 ring-[var(--filet)]" aria-hidden />
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
                  <span className="chiffres w-6 shrink-0 text-right text-xs text-[var(--encre-faible)]">{rangee}</span>
                  {LETTRES_SIEGE.map((lettre, index) => {
                    const siege = `${rangee}${lettre}`;
                    const vendu = occupes.has(siege);
                    const choisi = selection.includes(siege);
                    return (
                      <span key={lettre} className="flex items-center">
                        <button
                          type="button"
                          disabled={vendu || !vendre}
                          onClick={() => basculer(siege)}
                          aria-pressed={choisi}
                          aria-label={vendu ? `Siège ${siege}, déjà vendu` : `Siège ${siege}, libre`}
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

      {/* Rappel collé en bas d'écran sur téléphone : les passagers et le bouton
          d'émission sont sous les quinze rangées du plan. */}
      {selection.length > 0 && (
        <a
          href="#recapitulatif-vente"
          className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-xl bg-marque-600 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:hidden"
        >
          <span>
            {selection.length} siège{selection.length > 1 ? "s" : ""} · {selection.join(", ")}
          </span>
          <span className="chiffres">{fmt(total)} F →</span>
        </a>
      )}

      <aside
        id="recapitulatif-vente"
        className="h-fit scroll-mt-4 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 lg:sticky lg:top-6"
      >
        <h2 className="text-base font-semibold">{depart.trajet}</h2>
        <p className="chiffres mt-0.5 text-xs text-[var(--encre-faible)]">
          {depart.reference} · {MOMENT.format(new Date(depart.partLe))}
        </p>

        <dl className="mt-3 space-y-2 border-t border-[var(--filet)] pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Tarif unitaire</dt>
            <dd className="chiffres font-semibold">{fmt(depart.tarif)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Encore libres</dt>
            <dd className="chiffres">
              {libres} / {capacite(depart.rangees)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-[var(--filet)] pt-3">
          <p className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">Passagers</p>
          {selection.length === 0 ? (
            <p className="text-sm text-[var(--encre-faible)]">
              {vendre ? "Touchez un siège libre sur le plan." : "Votre rôle ne permet pas de vendre."}
            </p>
          ) : (
            <ul className="space-y-3">
              {selection.map((siege) => (
                <li key={siege} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Pastille ton="marque">{siege}</Pastille>
                    <input
                      value={passagers[siege]?.nom ?? ""}
                      onChange={(e) => saisir(siege, "nom", e.target.value)}
                      placeholder="Nom du passager"
                      aria-label={`Nom du passager, siège ${siege}`}
                      className={`${CLASSE_CHAMP} h-9`}
                    />
                  </div>
                  <div className="flex gap-1.5 pl-11">
                    <input
                      value={passagers[siege]?.telephone ?? ""}
                      onChange={(e) => saisir(siege, "telephone", e.target.value)}
                      inputMode="tel"
                      placeholder="Téléphone"
                      aria-label={`Téléphone, siège ${siege}`}
                      className={`${CLASSE_CHAMP} chiffres h-9 text-xs`}
                    />
                    <input
                      value={passagers[siege]?.piece ?? ""}
                      onChange={(e) => saisir(siege, "piece", e.target.value)}
                      placeholder="Pièce d'identité"
                      aria-label={`Pièce d'identité, siège ${siege}`}
                      className={`${CLASSE_CHAMP} chiffres h-9 text-xs`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selection.length > 0 && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">Encaissement</span>
            <select value={moyen} onChange={(e) => setMoyen(e.target.value)} className={CLASSE_CHAMP}>
              <option value="especes">Espèces</option>
              <option value="mobile_money">Mobile money</option>
              <option value="banque">Carte / virement</option>
            </select>
          </label>
        )}

        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--filet)] pt-3">
          <span className="text-sm font-semibold">Total</span>
          <span className="chiffres text-2xl font-bold">
            {fmt(total)}
            <span className="ml-1 text-sm font-medium text-[var(--encre-faible)]">FCFA</span>
          </span>
        </div>

        <button
          type="button"
          disabled={selection.length === 0 || !complets || op.enCours}
          onClick={emettre}
          className="sans-selection mt-4 h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-40"
        >
          {op.enCours
            ? "Émission…"
            : selection.length === 0
              ? "Sélectionnez un siège"
              : !complets
                ? "Nommez chaque passager"
                : `Encaisser et émettre ${selection.length} billet${selection.length > 1 ? "s" : ""}`}
        </button>
        {op.resultat && <Retour resultat={op.resultat} />}
      </aside>
    </div>
  );
}
