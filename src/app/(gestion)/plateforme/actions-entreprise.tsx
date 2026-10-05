"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP_COMPACT } from "@/components/ui/primitives";
import { changerStatut, enregistrerPaiement } from "@/lib/abonnement/actions";

const MOYENS = [
  ["wave", "Wave"],
  ["orange_money", "Orange Money"],
  ["mtn_money", "MTN"],
  ["moov_money", "Moov"],
  ["virement", "Virement"],
  ["especes", "Espèces"],
  ["autre", "Autre"],
] as const;

type Moyen = (typeof MOYENS)[number][0];

/** Paiement reçu, suspension, réactivation, prolongation d'essai. */
export function ActionsEntreprise({
  id,
  nom,
  statut,
  plan,
  formules,
  aujourdhui,
}: {
  id: string;
  nom: string;
  statut: "essai" | "actif" | "suspendu" | "resilie";
  plan: string;
  formules: { cle: string; nom: string; prixMensuel: number | null }[];
  aujourdhui: string;
}) {
  const op = useOperation();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState({ plan, montant: "", mois: "1", moyen: "wave" as Moyen, reference: "", recuLe: aujourdhui });
  const prix = formules.find((f) => f.cle === saisie.plan)?.prixMensuel;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button type="button" onClick={() => setOuvert(!ouvert)} className="h-8 rounded-lg bg-valide-500 px-2.5 text-xs font-semibold text-white">
          Paiement reçu
        </button>
        {statut === "essai" && (
          <button type="button" disabled={op.enCours} onClick={() => op.lancer(() => changerStatut(id, "prolonger_essai", 14))} className="h-8 rounded-lg border border-[var(--filet)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-creuse)]">
            +14 j d&apos;essai
          </button>
        )}
        {statut === "suspendu" ? (
          <button type="button" disabled={op.enCours} onClick={() => op.lancer(() => changerStatut(id, "reactiver"))} className="h-8 rounded-lg border border-[var(--filet)] px-2.5 text-xs font-semibold hover:bg-[var(--surface-creuse)]">
            Réactiver
          </button>
        ) : (
          <button
            type="button"
            disabled={op.enCours}
            onClick={() => {
              if (window.confirm(`Suspendre ${nom} ? L'entreprise passe immédiatement en lecture seule.`)) op.lancer(() => changerStatut(id, "suspendre"));
            }}
            className="h-8 rounded-lg border border-danger-500 px-2.5 text-xs font-semibold text-danger-600 hover:bg-danger-50"
          >
            Suspendre
          </button>
        )}
      </div>

      {ouvert && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            op.lancer(
              () =>
                enregistrerPaiement(id, {
                  plan: saisie.plan,
                  montant: Number(saisie.montant),
                  mois: Number(saisie.mois),
                  moyen: saisie.moyen,
                  reference: saisie.reference || undefined,
                  recuLe: saisie.recuLe,
                }),
              () => setOuvert(false),
            );
          }}
          className="mt-1 grid w-[min(100%,26rem)] grid-cols-2 gap-2 rounded-lg border border-[var(--filet)] bg-[var(--surface-creuse)] p-3 text-left text-xs"
        >
          <label>
            <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Formule</span>
            <select value={saisie.plan} onChange={(e) => setSaisie({ ...saisie, plan: e.target.value })} className={`${CLASSE_CHAMP_COMPACT} h-9 w-full`}>
              {formules.map((f) => (
                <option key={f.cle} value={f.cle}>
                  {f.nom}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Mois couverts</span>
            <input
              type="number"
              min={-24}
              max={36}
              value={saisie.mois}
              onChange={(e) => setSaisie({ ...saisie, mois: e.target.value, montant: prix && !saisie.montant ? String(prix * Number(e.target.value)) : saisie.montant })}
              className={`${CLASSE_CHAMP_COMPACT} h-9 w-full`}
            />
          </label>
          <label>
            <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Montant (F)</span>
            <input type="number" required value={saisie.montant} onChange={(e) => setSaisie({ ...saisie, montant: e.target.value })} className={`${CLASSE_CHAMP_COMPACT} h-9 w-full`} />
          </label>
          <label>
            <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Moyen</span>
            <select value={saisie.moyen} onChange={(e) => setSaisie({ ...saisie, moyen: e.target.value as Moyen })} className={`${CLASSE_CHAMP_COMPACT} h-9 w-full`}>
              {MOYENS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Référence</span>
            <input value={saisie.reference} onChange={(e) => setSaisie({ ...saisie, reference: e.target.value })} placeholder="ID de transaction" className={`${CLASSE_CHAMP_COMPACT} h-9 w-full`} />
          </label>
          <label>
            <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Reçu le</span>
            <input type="date" value={saisie.recuLe} onChange={(e) => setSaisie({ ...saisie, recuLe: e.target.value })} className={`${CLASSE_CHAMP_COMPACT} h-9 w-full`} />
          </label>
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOuvert(false)} className="h-9 text-[var(--encre-faible)] hover:underline">
              Retour
            </button>
            <button type="submit" disabled={op.enCours} className="h-9 rounded-lg bg-valide-500 px-4 font-semibold text-white disabled:opacity-50">
              {op.enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}
      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}
