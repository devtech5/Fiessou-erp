"use client";

import { useActionState, useState } from "react";

import { fmt } from "@/lib/format";
import {
  cloturerSessionCaisse,
  ouvrirSessionCaisse,
  type EtatCloture,
  type EtatSession,
} from "@/modules/ventes/actions-session";
import type { MoyenComptable } from "@/modules/ventes/session";

export interface SessionVue {
  id: string;
  caissier: string;
  fondInitial: number;
  ouverteLe: string;
}

export interface AttenduVue {
  tickets: number;
  chiffreAffaires: number;
  especesEnTiroir: number;
  aCredit: number;
  parMoyen: { moyen: MoyenComptable; attendu: number }[];
}

const LIBELLE: Record<MoyenComptable, string> = {
  especes: "Espèces",
  mobile_money: "Mobile money",
  carte: "Carte",
  banque: "Virement",
};

/**
 * Ouverture et clôture du tiroir.
 *
 * Le panneau vit sur l'écran de caisse, pas dans l'administration : c'est le
 * caissier qui ouvre son tiroir le matin et le compte le soir, et lui faire
 * traverser l'application pour ça garantit qu'il ne le fera pas.
 */
export function PanneauSession({
  poste,
  session,
  attendu,
}: {
  poste: { id: string; code: string; nom: string };
  session: SessionVue | null;
  attendu: AttenduVue | null;
}) {
  const [ouvert, setOuvert] = useState(false);

  /**
   * L'état de clôture vit ICI et non dans le formulaire.
   *
   * Une clôture réussie fait disparaître la session, donc le formulaire, donc
   * son résultat : le caissier ne verrait jamais l'écart qu'il vient de
   * constater. Or c'est le seul moment où il peut encore recompter.
   */
  const [cloture, actionCloture, clotureEnCours] = useActionState<
    EtatCloture,
    FormData
  >(cloturerSessionCaisse, {});

  // Le panneau se replie dès que le tiroir change d'état. Sans cela, ouvrir la
  // caisse enchaînerait directement sur le formulaire de clôture — le geste
  // suivant proposé serait de fermer ce qu'on vient d'ouvrir.
  const [dernierEtat, setDernierEtat] = useState(session?.id ?? null);
  if ((session?.id ?? null) !== dernierEtat) {
    setDernierEtat(session?.id ?? null);
    setOuvert(false);
  }

  if (!session) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {cloture.resultat && <Verdict ecart={cloture.resultat.ecart} />}
        <Ouverture poste={poste} ouvert={ouvert} setOuvert={setOuvert} />
      </div>
    );
  }

  return (
    <Cloture
      session={session}
      attendu={attendu}
      ouvert={ouvert}
      setOuvert={setOuvert}
      etat={cloture}
      action={actionCloture}
      enCours={clotureEnCours}
    />
  );
}

/**
 * Verdict du comptage.
 *
 * Reste affiché après la clôture, tiroir fermé : un écart annoncé une demi-
 * seconde puis remplacé par « ouvrir la caisse » n'est pas un écart annoncé.
 */
function Verdict({ ecart }: { ecart: number }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        ecart === 0 ? "bg-valide-50 text-valide-600" : "bg-alerte-50 text-alerte-600"
      }`}
    >
      {ecart === 0
        ? "Caisse clôturée, tiroir juste"
        : `Caisse clôturée · ${ecart > 0 ? "excédent" : "manque"} de ${fmt(Math.abs(ecart))}`}
    </span>
  );
}

function Ouverture({
  poste,
  ouvert,
  setOuvert,
}: {
  poste: { id: string; code: string };
  ouvert: boolean;
  setOuvert: (valeur: boolean) => void;
}) {
  const [etat, action, enCours] = useActionState<EtatSession, FormData>(
    ouvrirSessionCaisse,
    {},
  );

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="rounded-full bg-alerte-50 px-2.5 py-1 text-xs font-semibold text-alerte-600 hover:bg-alerte-100"
      >
        Tiroir non ouvert
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--filet)] bg-[var(--surface)] p-2"
    >
      <input type="hidden" name="caisseId" value={poste.id} />
      <label className="text-xs">
        <span className="block text-[var(--encre-faible)]">
          Fond de caisse ({poste.code})
        </span>
        <input
          name="fondInitial"
          inputMode="numeric"
          defaultValue="0"
          autoFocus
          className="chiffres mt-0.5 h-9 w-32 rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-2 text-sm outline-none focus:border-marque-500"
        />
      </label>

      <button
        type="submit"
        disabled={enCours}
        className="h-9 rounded-lg bg-marque-600 px-3 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        {enCours ? "Ouverture…" : "Ouvrir la caisse"}
      </button>
      <button
        type="button"
        onClick={() => setOuvert(false)}
        className="h-9 px-2 text-xs text-[var(--encre-faible)] hover:underline"
      >
        Plus tard
      </button>

      {etat.erreur && (
        <p role="alert" className="w-full text-xs font-medium text-danger-600">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}

function Cloture({
  session,
  attendu,
  ouvert,
  setOuvert,
  etat,
  action,
  enCours,
}: {
  session: SessionVue;
  attendu: AttenduVue | null;
  ouvert: boolean;
  setOuvert: (valeur: boolean) => void;
  etat: EtatCloture;
  action: (donnees: FormData) => void;
  enCours: boolean;
}) {
  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="rounded-full bg-valide-50 px-2.5 py-1 text-xs font-semibold text-valide-600 hover:bg-valide-100"
      >
        Tiroir ouvert
        {attendu ? ` · ${fmt(attendu.especesEnTiroir)} attendus` : ""}
      </button>
    );
  }

  return (
    <form
      action={action}
      className="w-full rounded-lg border border-[var(--filet)] bg-[var(--surface)] p-3"
    >
      <input type="hidden" name="sessionId" value={session.id} />

      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          Comptage de clôture — {session.caissier}
        </p>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-xs text-[var(--encre-faible)] hover:underline"
        >
          Annuler
        </button>
      </div>

      {/* Ce que le tiroir devrait contenir est affiché : cacher l'attendu pour
          « ne pas influencer » le caissier le pousse surtout à recompter trois
          fois sans savoir ce qu'il cherche. L'écart, lui, est enregistré. */}
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg bg-[var(--surface-creuse)] px-2 py-1">
          {attendu?.tickets ?? 0} ticket{(attendu?.tickets ?? 0) > 1 ? "s" : ""}
        </span>
        <span className="rounded-lg bg-[var(--surface-creuse)] px-2 py-1">
          Fond <span className="chiffres">{fmt(session.fondInitial)}</span>
        </span>
        {(attendu?.aCredit ?? 0) > 0 && (
          <span className="rounded-lg bg-alerte-50 px-2 py-1 text-alerte-600">
            <span className="chiffres">{fmt(attendu?.aCredit ?? 0)}</span> à
            crédit — pas dans le tiroir
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {(attendu?.parMoyen ?? []).map((part) => {
          const du =
            part.moyen === "especes"
              ? part.attendu + session.fondInitial
              : part.attendu;

          return (
            <label key={part.moyen} className="text-xs">
              <span className="block text-[var(--encre-faible)]">
                {LIBELLE[part.moyen]} · attendu{" "}
                <span className="chiffres">{fmt(du)}</span>
              </span>
              <input
                name={part.moyen}
                inputMode="numeric"
                defaultValue={String(du)}
                className="chiffres mt-0.5 h-9 w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-2 text-sm outline-none focus:border-marque-500"
              />
            </label>
          );
        })}
      </div>

      <label className="mt-2 block text-xs">
        <span className="block text-[var(--encre-faible)]">
          Motif — obligatoire dès qu&apos;un écart existe
        </span>
        <input
          name="motif"
          placeholder="Erreur de rendu de monnaie, billet manquant…"
          className="mt-0.5 h-9 w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-2 text-sm outline-none focus:border-marque-500"
        />
      </label>

      {etat.erreur && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-danger-50 px-2.5 py-2 text-xs font-medium text-danger-600"
        >
          {etat.erreur}
        </p>
      )}

      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={enCours}
          className="h-9 rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
        >
          {enCours ? "Clôture…" : "Clôturer la caisse"}
        </button>
      </div>
    </form>
  );
}
