"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { annulerBillet, basculerLigne, changerStatutDepart, embarquer } from "@/modules/billetterie/actions";
import type { StatutDepart } from "@/modules/billetterie/schema";

const PETIT = "h-9 rounded-lg px-2.5 text-xs font-semibold disabled:opacity-50";

/** Avancer un départ : embarquement, départ, annulation (motif et remboursement). */
export function ActionsDepart({
  id,
  statut,
  gerer,
  annuler,
}: {
  id: string;
  statut: StatutDepart;
  gerer: boolean;
  annuler: boolean;
}) {
  const op = useOperation();
  const [motif, setMotif] = useState<string | null>(null);

  if (statut === "parti" || statut === "annule") return null;
  if (!gerer && !annuler) return null;

  return (
    <div className="mt-3 border-t border-[var(--filet)] pt-3">
      {motif === null ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {gerer && statut === "ouvert" && (
            <button
              type="button"
              disabled={op.enCours}
              onClick={() => op.lancer(() => changerStatutDepart(id, "embarquement"))}
              className={`${PETIT} bg-marque-600 text-white`}
            >
              Ouvrir l&apos;embarquement
            </button>
          )}
          {gerer && statut === "embarquement" && (
            <button
              type="button"
              disabled={op.enCours}
              onClick={() => op.lancer(() => changerStatutDepart(id, "parti"))}
              className={`${PETIT} bg-marque-600 text-white`}
            >
              Faire partir le car
            </button>
          )}
          {annuler && (
            <button type="button" onClick={() => setMotif("")} className={`${PETIT} border border-[var(--filet)] text-danger-600`}>
              Annuler le départ
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--encre-douce)]">
            Tous les billets du départ seront annulés et remboursés.
          </p>
          <div className="flex gap-1.5">
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif : panne, route coupée…"
              aria-label="Motif d'annulation du départ"
              className={`${CLASSE_CHAMP} h-9`}
            />
            <button
              type="button"
              disabled={op.enCours || motif.trim().length < 3}
              onClick={() => op.lancer(() => changerStatutDepart(id, "annule", motif), () => setMotif(null))}
              className={`${PETIT} shrink-0 bg-danger-500 text-white`}
            >
              Confirmer
            </button>
            <button type="button" onClick={() => setMotif(null)} className={`${PETIT} text-[var(--encre-faible)]`}>
              Fermer
            </button>
          </div>
        </div>
      )}
      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}

/**
 * Contrôle à la montée. Le champ reçoit la saisie d'une douchette comme d'un
 * clavier : un lecteur de code tape le numéro puis Entrée.
 */
export function ControleEmbarquement() {
  const op = useOperation();
  const [numero, setNumero] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!numero.trim()) return;
        op.lancer(() => embarquer(numero), () => setNumero(""));
      }}
      className="mb-5 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
    >
      <label htmlFor="controle-billet" className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
        Contrôle à la montée — scannez ou saisissez le numéro du billet
      </label>
      <div className="flex gap-2">
        <input
          id="controle-billet"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="BIL-2026-000001"
          autoComplete="off"
          className={`${CLASSE_CHAMP} chiffres`}
        />
        <button
          type="submit"
          disabled={op.enCours || !numero.trim()}
          className="h-cible shrink-0 rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Contrôler
        </button>
      </div>
      {op.resultat && <Retour resultat={op.resultat} />}
    </form>
  );
}

export function AnnulationBillet({ id, numero }: { id: string; numero: string }) {
  const op = useOperation();
  const [motif, setMotif] = useState<string | null>(null);

  if (motif === null) {
    return (
      <div className="text-right">
        <button type="button" onClick={() => setMotif("")} className="text-xs font-medium text-danger-600 hover:underline">
          Annuler
        </button>
        {op.resultat && <Retour resultat={op.resultat} />}
      </div>
    );
  }

  return (
    <div className="min-w-56">
      <div className="flex items-center justify-end gap-1.5">
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          autoFocus
          placeholder="Motif"
          aria-label={`Motif d'annulation du billet ${numero}`}
          className={`${CLASSE_CHAMP} h-8 w-36 text-xs`}
        />
        <button
          type="button"
          disabled={op.enCours || motif.trim().length < 3}
          onClick={() => op.lancer(() => annulerBillet(id, motif), () => setMotif(null))}
          className="h-8 rounded-lg bg-danger-500 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Rembourser
        </button>
        <button type="button" onClick={() => setMotif(null)} aria-label="Fermer" className="text-xs text-[var(--encre-faible)]">
          ×
        </button>
      </div>
      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}

export function BasculeLigne({ id, active }: { id: string; active: boolean }) {
  const op = useOperation();
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={op.enCours}
        onClick={() => op.lancer(() => basculerLigne(id))}
        className="text-xs font-medium text-marque-600 hover:underline disabled:opacity-50"
      >
        {active ? "Suspendre" : "Rouvrir"}
      </button>
      {op.resultat && !op.resultat.ok && <Retour resultat={op.resultat} />}
    </div>
  );
}
