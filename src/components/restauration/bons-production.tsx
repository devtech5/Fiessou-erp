"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Retour, type Resultat } from "@/components/ui/operations";
import { Pastille } from "@/components/ui/primitives";
import { formaterQuantite, type CodeUnite } from "@/lib/quantite";
import { avancerLignes } from "@/modules/restauration/actions";
import { LIBELLE_POSTE, libelleDuree, type Espace, type Poste } from "@/modules/restauration/calcul";

export interface BonVue {
  commandeId: string;
  numero: string;
  repere: string;
  lignes: {
    id: string;
    designation: string;
    quantite: number;
    unite: CodeUnite;
    note: string | null;
    poste: Poste;
    etat: "envoyee" | "prete";
    minutes: number;
    retard: boolean;
  }[];
}

export function BonsProduction({
  espace,
  bons,
  peutPreparer,
  peutServir,
}: {
  espace: Espace;
  bons: BonVue[];
  peutPreparer: boolean;
  peutServir: boolean;
}) {
  const routeur = useRouter();
  const [enCours, demarrer] = useTransition();
  const [resultat, setResultat] = useState<Resultat | null>(null);

  function avancer(ids: string[], vers: "prete" | "servie") {
    setResultat(null);
    demarrer(async () => {
      const r = await avancerLignes(espace, ids, vers);
      if (!r.ok) setResultat(r);
      routeur.refresh();
    });
  }

  return (
    <>
      <Retour resultat={resultat} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {bons.map((bon) => {
          const enPreparation = bon.lignes.filter((l) => l.etat === "envoyee");
          const pretes = bon.lignes.filter((l) => l.etat === "prete");
          const retard = enPreparation.some((l) => l.retard);
          return (
            <article
              key={bon.commandeId}
              className={`flex flex-col rounded-xl border-2 bg-[var(--surface)] ${retard ? "border-danger-600" : "border-[var(--filet)]"}`}
            >
              <header className="flex items-baseline justify-between gap-2 border-b border-[var(--filet)] px-3.5 py-2.5">
                <p className="truncate text-base font-bold">{bon.repere}</p>
                <span className="chiffres shrink-0 text-xs text-[var(--encre-faible)]">{bon.numero}</span>
              </header>
              <ul className="flex-1 divide-y divide-[var(--filet)]">
                {bon.lignes.map((l) => (
                  <li key={l.id} className={`flex items-start justify-between gap-3 px-3.5 py-2 ${l.etat === "prete" ? "opacity-60" : ""}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        <span className="chiffres">{formaterQuantite(l.quantite, l.unite)}</span> × {l.designation}
                      </p>
                      {l.note && <p className="text-sm font-medium text-alerte-600">{l.note}</p>}
                      <p className="text-[11px] text-[var(--encre-faible)]">
                        {LIBELLE_POSTE[l.poste]} · {libelleDuree(l.minutes)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {l.etat === "prete" ? (
                        <Pastille ton="alerte">Prête</Pastille>
                      ) : l.retard ? (
                        <Pastille ton="danger">En retard</Pastille>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <footer className="flex flex-wrap gap-2 border-t border-[var(--filet)] p-2.5">
                {peutPreparer && enPreparation.length > 0 && (
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => avancer(enPreparation.map((l) => l.id), "prete")}
                    className="h-touche flex-1 rounded-xl bg-marque-600 px-3 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
                  >
                    Prêt
                  </button>
                )}
                {peutServir && pretes.length > 0 && (
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => avancer(pretes.map((l) => l.id), "servie")}
                    className="h-touche flex-1 rounded-xl border border-[var(--filet)] px-3 text-sm font-semibold hover:bg-[var(--surface-creuse)] disabled:opacity-50"
                  >
                    Servi
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}
