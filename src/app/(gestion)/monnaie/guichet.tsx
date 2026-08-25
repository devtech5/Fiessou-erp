"use client";

import { useState } from "react";

import { BoutonPrincipal, Pastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import {
  RESEAUX,
  SEUIL_FLOAT_BAS,
  calculerCommission,
  type Reseau,
  type TypeOperation,
} from "@/lib/fixtures/monnaie";

const TYPES: { id: TypeOperation; libelle: string; aide: string }[] = [
  { id: "depot", libelle: "Dépôt", aide: "Le client remet des espèces" },
  { id: "retrait", libelle: "Retrait", aide: "Le client emporte des espèces" },
  { id: "credit", libelle: "Crédit", aide: "Vente de crédit d'appel" },
];

/**
 * Guichet.
 *
 * L'écran affiche en permanence l'effet de l'opération sur les deux réserves —
 * float et espèces — avant validation. C'est ce qui empêche l'erreur la plus
 * coûteuse du métier : accepter un retrait que le float ne couvre pas, ou
 * vider une caisse dont on n'a pas suivi le niveau.
 */
export function Guichet() {
  const [type, setType] = useState<TypeOperation>("depot");
  const [reseau, setReseau] = useState<Reseau>("wave");
  const [numero, setNumero] = useState("");
  const [montant, setMontant] = useState(0);

  const commission = calculerCommission(montant);
  const info = RESEAUX.find((r) => r.id === reseau)!;

  // Un dépôt et une vente de crédit consomment du float ; un retrait en
  // reconstitue. Les espèces vont dans l'autre sens.
  const consommeFloat = type === "depot" || type === "credit";
  const floatApres = consommeFloat ? info.float - montant : info.float + montant;

  const floatInsuffisant = consommeFloat && montant > info.float;
  const operationValide = montant > 0 && numero.trim().length > 0 && !floatInsuffisant;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      {/* --------------------------------------------------- la saisie */}
      <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">
            Opération
          </legend>
          <div className="grid grid-cols-3 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`sans-selection h-touche rounded-lg border text-sm font-semibold ${
                  type === t.id
                    ? "border-marque-600 bg-marque-600 text-white"
                    : "border-[var(--filet)] text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                {t.libelle}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--encre-faible)]">
            {TYPES.find((t) => t.id === type)!.aide}
          </p>
        </fieldset>

        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">
            Réseau
          </legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {RESEAUX.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReseau(r.id)}
                className={`sans-selection h-cible rounded-lg border px-1 text-xs font-semibold ${
                  reseau === r.id
                    ? "border-marque-600 bg-marque-600 text-white"
                    : "border-[var(--filet)] text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                {r.nom}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
            Numéro du client
          </span>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            inputMode="tel"
            placeholder="07 00 00 00 00"
            className="chiffres h-touche w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-base outline-none focus:border-marque-500"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
            Montant
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              value={montant || ""}
              onChange={(e) =>
                setMontant(Math.max(0, Math.round(Number(e.target.value) || 0)))
              }
              placeholder="0"
              className="chiffres h-touche w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-right text-xl font-bold outline-none focus:border-marque-500"
            />
            <span className="shrink-0 text-sm text-[var(--encre-faible)]">FCFA</span>
          </div>
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[1_000, 2_000, 5_000, 10_000, 25_000, 50_000].map((valeur) => (
            <button
              key={valeur}
              type="button"
              onClick={() => setMontant(valeur)}
              className="sans-selection chiffres h-cible rounded-lg border border-[var(--filet)] px-3 text-sm hover:bg-[var(--surface-creuse)]"
            >
              {fmt(valeur)}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------ effet et validation */}
      <aside className="h-fit rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="text-base font-semibold">Effet de l&apos;opération</h2>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Montant</dt>
            <dd className="chiffres font-semibold">{fmt(montant)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--encre-faible)]">Commission</dt>
            <dd className="chiffres font-semibold text-valide-600">
              + {fmt(commission)}
            </dd>
          </div>
        </dl>

        <div className="mt-3 space-y-2 border-t border-[var(--filet)] pt-3">
          <div className="rounded-lg bg-[var(--surface-creuse)] p-3">
            <p className="text-xs text-[var(--encre-faible)]">
              Float {info.nom}
            </p>
            <p className="chiffres text-sm">
              {fmt(info.float)}
              <span className="mx-1.5 text-[var(--encre-faible)]">→</span>
              <span
                className={`font-bold ${
                  floatInsuffisant
                    ? "text-danger-600"
                    : floatApres < SEUIL_FLOAT_BAS
                      ? "text-alerte-600"
                      : ""
                }`}
              >
                {fmt(Math.max(0, floatApres))}
              </span>
            </p>
          </div>

          <div className="rounded-lg bg-[var(--surface-creuse)] p-3">
            <p className="text-xs text-[var(--encre-faible)]">Espèces en caisse</p>
            <p className="chiffres text-sm font-bold">
              {type === "retrait" ? "−" : "+"}{" "}
              {fmt(type === "retrait" ? montant - commission : montant + commission)}
            </p>
          </div>
        </div>

        {floatInsuffisant && (
          <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2.5 text-xs font-medium text-danger-600">
            Float {info.nom} insuffisant. Rechargez avant de valider — l&apos;opération
            échouerait chez l&apos;opérateur après avoir encaissé le client.
          </p>
        )}

        {!floatInsuffisant && floatApres < SEUIL_FLOAT_BAS && montant > 0 && (
          <p className="mt-3 rounded-lg bg-alerte-50 px-3 py-2.5 text-xs font-medium text-alerte-600">
            Float bas après cette opération. Prévoyez un rechargement.
          </p>
        )}

        <div className="mt-4">
          <button
            type="button"
            disabled={!operationValide}
            className="sans-selection h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-40"
          >
            Valider et imprimer le reçu
          </button>
        </div>
      </aside>
    </div>
  );
}

/** Bandeau des floats, affiché en tête du guichet. */
export function BandeauFloat() {
  return (
    <ul className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {RESEAUX.map((reseau) => {
        const bas = reseau.float < SEUIL_FLOAT_BAS;
        const variation = reseau.float - reseau.floatOuverture;

        return (
          <li
            key={reseau.id}
            className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{reseau.nom}</p>
              {bas && <Pastille ton="alerte">Bas</Pastille>}
            </div>
            <p
              className={`chiffres mt-1 text-xl font-bold ${bas ? "text-alerte-600" : ""}`}
            >
              {fmt(reseau.float)}
            </p>
            <p className="chiffres mt-0.5 text-xs text-[var(--encre-faible)]">
              {variation >= 0 ? "+" : "−"} {fmt(Math.abs(variation))} depuis
              l&apos;ouverture
            </p>
          </li>
        );
      })}
    </ul>
  );
}
