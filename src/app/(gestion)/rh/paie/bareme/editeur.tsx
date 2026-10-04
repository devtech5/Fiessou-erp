"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { enregistrerBareme } from "@/modules/paie/actions";
import { calculerBulletinPaie, impotProgressif, type BaremePaie } from "@/modules/paie/calcul";

const libelle = "mb-1 block text-xs font-semibold text-[var(--encre-faible)]";
/** Saisie en pour cent (6,30), stockage en points de base (630). */
const versBp = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);
const depuisBp = (bp: number) => String(bp / 100).replace(".", ",");

/**
 * Édition du barème. Un exemple de bulletin se recalcule à chaque frappe :
 * c'est lui qu'on confronte à un bulletin réel avant d'attester.
 */
export function EditeurBareme({ initial }: { initial: BaremePaie }) {
  const op = useOperation();
  const [taux, setTaux] = useState({
    sal: depuisBp(initial.cnpsRetraiteSalarieBp),
    pat: depuisBp(initial.cnpsRetraitePatronalBp),
    pf: depuisBp(initial.prestationsFamilialesBp),
    at: depuisBp(initial.accidentTravailBp),
    plafond: String(initial.cnpsPlafondMensuel),
  });
  const [tranches, setTranches] = useState(initial.tranchesImpot.map((t) => ({ seuil: String(t.seuil), taux: depuisBp(t.tauxBp) })));
  const [atteste, setAtteste] = useState(false);
  const [exemple, setExemple] = useState("250000");

  const bareme: BaremePaie = {
    cnpsRetraiteSalarieBp: versBp(taux.sal),
    cnpsRetraitePatronalBp: versBp(taux.pat),
    prestationsFamilialesBp: versBp(taux.pf),
    accidentTravailBp: versBp(taux.at),
    cnpsPlafondMensuel: Number(taux.plafond.replace(/\s/g, "")) || 0,
    tranchesImpot: tranches.map((t) => ({ seuil: Number(t.seuil.replace(/\s/g, "")) || 0, tauxBp: versBp(t.taux) })),
  };
  let apercu: ReturnType<typeof calculerBulletinPaie> | null = null;
  try {
    apercu = calculerBulletinPaie({ salaireBase: Number(exemple.replace(/\s/g, "")) || 0, primesImposables: 0, indemnitesNonImposables: 0, retenuesDiverses: 0 }, bareme);
  } catch {
    apercu = null;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-base font-semibold">Cotisations CNPS</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["sal", "Retraite, part salariale (%)"],
              ["pat", "Retraite, part patronale (%)"],
              ["pf", "Prestations familiales, patronal (%)"],
              ["at", "Accident du travail, patronal (%)"],
            ] as const
          ).map(([cle, texte]) => (
            <label key={cle} className="block">
              <span className={libelle}>{texte}</span>
              <input inputMode="decimal" value={taux[cle]} onChange={(e) => setTaux({ ...taux, [cle]: e.target.value })} className={`${CLASSE_CHAMP} chiffres`} />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className={libelle}>Plafond mensuel de l&apos;assiette retraite (F)</span>
            <input inputMode="numeric" value={taux.plafond} onChange={(e) => setTaux({ ...taux, plafond: e.target.value })} className={`${CLASSE_CHAMP} chiffres`} />
          </label>
        </div>

        <h2 className="mb-1 mt-6 text-base font-semibold">Impôt sur salaire</h2>
        <p className="mb-3 text-xs text-[var(--encre-faible)]">Tranches marginales : chaque taux frappe la part du revenu imposable (brut moins CNPS salariale) au-dessus de son seuil.</p>
        <ul className="space-y-2">
          {tranches.map((t, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className={libelle}>Au-delà de (F)</span>
                <input inputMode="numeric" value={t.seuil} onChange={(e) => setTranches(tranches.map((x, j) => (j === i ? { ...x, seuil: e.target.value } : x)))} className={`${CLASSE_CHAMP} chiffres w-40`} />
              </label>
              <label className="block">
                <span className={libelle}>Taux (%)</span>
                <input inputMode="decimal" value={t.taux} onChange={(e) => setTranches(tranches.map((x, j) => (j === i ? { ...x, taux: e.target.value } : x)))} className={`${CLASSE_CHAMP} chiffres w-24`} />
              </label>
              <button type="button" onClick={() => setTranches(tranches.filter((_, j) => j !== i))} className="h-cible px-2 text-sm text-danger-600 hover:underline">
                Retirer
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setTranches([...tranches, { seuil: "", taux: "" }])} className="mt-2 rounded-lg border border-dashed border-[var(--filet)] px-3 py-2 text-sm hover:border-marque-400">
          + Ajouter une tranche
        </button>

        <label className="mt-6 flex items-start gap-2.5 rounded-lg border border-alerte-500 bg-alerte-50 p-3 text-sm text-alerte-600">
          <input type="checkbox" checked={atteste} onChange={(e) => setAtteste(e.target.checked)} className="mt-0.5 accent-marque-600" />
          <span>
            J&apos;atteste avoir vérifié ces taux auprès de la CNPS et de la DGI (ou de notre comptable), et les avoir confrontés à un bulletin réel.
            Sans cette attestation, le barème est enregistré mais aucune paie ne peut être validée.
          </span>
        </label>
        {op.resultat && <Retour resultat={op.resultat} />}
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={op.enCours} onClick={() => op.lancer(() => enregistrerBareme(bareme, atteste))} className="h-cible rounded-lg bg-marque-500 px-4 text-sm font-semibold text-white disabled:opacity-50">
            {op.enCours ? "Enregistrement…" : atteste ? "Enregistrer et attester" : "Enregistrer sans attester"}
          </button>
        </div>
      </section>

      <aside className="h-fit rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 lg:sticky lg:top-6">
        <h2 className="text-base font-semibold">Bulletin d&apos;exemple</h2>
        <label className="mt-3 block">
          <span className={libelle}>Salaire brut mensuel (F)</span>
          <input inputMode="numeric" value={exemple} onChange={(e) => setExemple(e.target.value)} className={`${CLASSE_CHAMP} chiffres`} />
        </label>
        {apercu ? (
          <dl className="chiffres mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt>Brut</dt><dd>{fmt(apercu.brut)}</dd></div>
            <div className="flex justify-between"><dt>CNPS salariale</dt><dd>− {fmt(apercu.cnpsSalarie)}</dd></div>
            <div className="flex justify-between"><dt>Base imposable</dt><dd>{fmt(apercu.baseImposable)}</dd></div>
            <div className="flex justify-between"><dt>Impôt</dt><dd>− {fmt(impotProgressif(apercu.baseImposable, bareme.tranchesImpot))}</dd></div>
            <div className="flex justify-between border-t border-[var(--filet)] pt-1 font-bold"><dt>Net à payer</dt><dd>{fmt(apercu.net)}</dd></div>
            <div className="flex justify-between pt-2 text-[var(--encre-faible)]"><dt>Charges patronales</dt><dd>{fmt(apercu.chargesPatronales)}</dd></div>
            <div className="flex justify-between text-[var(--encre-faible)]"><dt>Coût employeur</dt><dd>{fmt(apercu.coutTotal)}</dd></div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-danger-600">Barème incomplet.</p>
        )}
        <p className="mt-3 text-xs text-[var(--encre-faible)]">Comparez ce résultat à un bulletin établi par votre comptable ou par l&apos;ancien logiciel avant d&apos;attester.</p>
      </aside>
    </div>
  );
}
