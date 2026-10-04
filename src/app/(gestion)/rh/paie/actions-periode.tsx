"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP_COMPACT } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { payerSalaires, preparerPaie, validerPaie, verser } from "@/modules/paie/actions";

/** Préparer un mois : celui affiché s'il n'est pas validé, ou un autre. */
export function PreparerMois({ moisCourant, mois, dejaValidee }: { moisCourant: string; mois: string; dejaValidee: boolean }) {
  const op = useOperation();
  const routeur = useRouter();
  const [choisi, setChoisi] = useState(dejaValidee ? moisCourant : mois);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <input type="month" value={choisi} onChange={(e) => setChoisi(e.target.value)} aria-label="Mois à préparer" className={`${CLASSE_CHAMP_COMPACT} h-cible`} />
        <button
          type="button"
          disabled={op.enCours || !choisi}
          onClick={() => op.lancer(() => preparerPaie(choisi), () => routeur.push(`/rh/paie?mois=${choisi}`))}
          className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {op.enCours ? "Calcul…" : "Préparer / recalculer"}
        </button>
      </div>
      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}

interface Compte {
  id: string;
  nom: string;
  nature: string;
  solde: number;
}

/** Valider, payer les nets, verser la CNPS et l'impôt : chaque geste à son tour. */
export function ActionsPeriode({
  periodeId,
  mois,
  validee,
  baremeVerifie,
  droits,
  nonPayes,
  montantNonPaye,
  cnps,
  impot,
  comptes,
  aujourdhui,
}: {
  periodeId: string;
  mois: string;
  validee: boolean;
  baremeVerifie: boolean;
  droits: { valider: boolean; payer: boolean };
  nonPayes: number;
  montantNonPaye: number;
  cnps: { montant: number; verse: boolean };
  impot: { montant: number; verse: boolean };
  comptes: Compte[];
  aujourdhui: string;
}) {
  const op = useOperation();
  const [confirmer, setConfirmer] = useState(false);
  const [paiement, setPaiement] = useState<{ type: "salaires" | "cnps" | "impot"; compte: string; date: string } | null>(null);
  const banque = comptes.find((c) => c.nature === "banque")?.id ?? comptes[0]?.id ?? "";

  return (
    <div className="mb-5 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!validee && droits.valider && !confirmer && (
          <button
            type="button"
            disabled={!baremeVerifie}
            onClick={() => setConfirmer(true)}
            title={baremeVerifie ? undefined : "Attestez d'abord le barème"}
            className="h-cible rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            Valider la paie
          </button>
        )}
        {!validee && confirmer && (
          <span className="flex flex-wrap items-center gap-2 rounded-lg border border-alerte-500 bg-alerte-50 px-3 py-2 text-sm text-alerte-600">
            Les bulletins seront numérotés, figés et passés en comptabilité. Une erreur se corrigera le mois suivant.
            <button
              type="button"
              disabled={op.enCours}
              onClick={() => op.lancer(() => validerPaie(periodeId), () => setConfirmer(false))}
              className="rounded-lg bg-marque-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              {op.enCours ? "Validation…" : "Confirmer la validation"}
            </button>
            <button type="button" onClick={() => setConfirmer(false)} className="hover:underline">
              Retour
            </button>
          </span>
        )}
        {validee && droits.payer && comptes.length > 0 && (
          <>
            {nonPayes > 0 && (
              <button type="button" onClick={() => setPaiement({ type: "salaires", compte: banque, date: aujourdhui })} className="h-cible rounded-lg bg-valide-500 px-4 text-sm font-semibold text-white">
                Payer les salaires ({nonPayes} · {fmt(montantNonPaye)} F)
              </button>
            )}
            {!cnps.verse && cnps.montant > 0 && (
              <button type="button" onClick={() => setPaiement({ type: "cnps", compte: banque, date: aujourdhui })} className="h-cible rounded-lg border border-[var(--filet)] px-3.5 text-sm font-semibold hover:bg-[var(--surface-creuse)]">
                Verser la CNPS ({fmt(cnps.montant)} F)
              </button>
            )}
            {!impot.verse && impot.montant > 0 && (
              <button type="button" onClick={() => setPaiement({ type: "impot", compte: banque, date: aujourdhui })} className="h-cible rounded-lg border border-[var(--filet)] px-3.5 text-sm font-semibold hover:bg-[var(--surface-creuse)]">
                Verser l&apos;impôt ({fmt(impot.montant)} F)
              </button>
            )}
          </>
        )}
        {validee && (
          <a href={`/imprimer/declarations/${periodeId}`} target="_blank" rel="noopener" className="h-cible inline-flex items-center rounded-lg border border-[var(--filet)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]">
            État CNPS et impôt
          </a>
        )}
        {validee && droits.payer && comptes.length === 0 && <span className="text-sm text-alerte-600">Déclarez un compte de trésorerie pour payer les salaires.</span>}
        {!validee && !droits.valider && <span className="text-sm text-[var(--encre-faible)]">La validation revient au gérant ou au propriétaire.</span>}
      </div>

      {paiement && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const r = () =>
              paiement.type === "salaires"
                ? payerSalaires(periodeId, { compteTresorerieId: paiement.compte, date: paiement.date })
                : verser(periodeId, paiement.type, { compteTresorerieId: paiement.compte, date: paiement.date });
            op.lancer(r, () => setPaiement(null));
          }}
          className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--filet)] bg-[var(--surface-creuse)] p-3"
        >
          <p className="w-full text-sm font-semibold">
            {paiement.type === "salaires" ? `Salaires de ${mois}` : paiement.type === "cnps" ? "Versement à la CNPS" : "Versement de l'impôt retenu"}
          </p>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Payé depuis</span>
            <select value={paiement.compte} onChange={(e) => setPaiement({ ...paiement, compte: e.target.value })} className={`${CLASSE_CHAMP_COMPACT} h-9`}>
              {comptes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} — {fmt(c.solde)} F
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Date</span>
            <input type="date" value={paiement.date} onChange={(e) => setPaiement({ ...paiement, date: e.target.value })} className={`${CLASSE_CHAMP_COMPACT} h-9`} />
          </label>
          <button type="submit" disabled={op.enCours} className="h-9 rounded-lg bg-valide-500 px-4 text-sm font-semibold text-white disabled:opacity-50">
            {op.enCours ? "Paiement…" : "Payer"}
          </button>
          <button type="button" onClick={() => setPaiement(null)} className="h-9 text-sm text-[var(--encre-faible)] hover:underline">
            Retour
          </button>
        </form>
      )}
      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}
