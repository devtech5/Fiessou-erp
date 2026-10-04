"use client";

import { useState } from "react";

import { CLASSE_CHAMP } from "@/components/ui/primitives";
import {
  annulerContrat,
  changerStatutRessource,
  enregistrerPassage,
  remettre,
  restituer,
} from "@/modules/reservations/actions";
import { FormulaireRepliable, Retour, useOperation } from "@/components/ui/operations";

export { FormulaireRepliable };

const PETIT = "h-9 rounded-lg px-2.5 text-xs font-semibold disabled:opacity-50";

/** Actions d'un contrat selon son statut : remettre, annuler, restituer. */
export function ActionsContrat({
  id,
  statut,
  caution,
}: {
  id: string;
  statut: "reserve" | "en_cours" | "restitue" | "annule";
  caution: number;
}) {
  const op = useOperation();
  const [panneau, setPanneau] = useState<"remettre" | "annuler" | "restituer" | null>(null);
  const [moyen, setMoyen] = useState("especes");
  const [motif, setMotif] = useState("");
  const [etat, setEtat] = useState("bon");
  const [retenue, setRetenue] = useState("0");

  if (statut === "restitue" || statut === "annule") return null;

  return (
    <div className={panneau === null ? "text-left" : "min-w-48 text-left"}>
      {panneau === null && (
        <div className="flex justify-end gap-1.5 whitespace-nowrap">
          {statut === "reserve" && (
            <>
              <button type="button" onClick={() => setPanneau("remettre")} className={`${PETIT} bg-marque-600 text-white`}>
                Remettre
              </button>
              <button type="button" onClick={() => setPanneau("annuler")} className={`${PETIT} border border-[var(--filet)] text-danger-600`}>
                Annuler
              </button>
            </>
          )}
          {statut === "en_cours" && (
            <button type="button" onClick={() => setPanneau("restituer")} className={`${PETIT} bg-marque-600 text-white`}>
              Restituer
            </button>
          )}
        </div>
      )}

      {panneau === "remettre" && (
        <div className="space-y-1.5">
          <select value={moyen} onChange={(e) => setMoyen(e.target.value)} aria-label="Moyen d'encaissement" className={`${CLASSE_CHAMP} h-9`}>
            <option value="especes">Espèces</option>
            <option value="mobile_money">Mobile money</option>
            <option value="banque">Virement / chèque</option>
          </select>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={op.enCours}
              onClick={() => op.lancer(() => remettre(id, moyen), () => setPanneau(null))}
              className={`${PETIT} bg-marque-600 text-white`}
            >
              Encaisser et remettre
            </button>
            <button type="button" onClick={() => setPanneau(null)} className={`${PETIT} text-[var(--encre-faible)]`}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {panneau === "annuler" && (
        <div className="space-y-1.5">
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif" aria-label="Motif" className={`${CLASSE_CHAMP} h-9`} />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={op.enCours || motif.trim().length < 3}
              onClick={() => op.lancer(() => annulerContrat(id, motif), () => setPanneau(null))}
              className={`${PETIT} bg-danger-500 text-white`}
            >
              Confirmer
            </button>
            <button type="button" onClick={() => setPanneau(null)} className={`${PETIT} text-[var(--encre-faible)]`}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {panneau === "restituer" && (
        <div className="space-y-1.5">
          <select value={etat} onChange={(e) => setEtat(e.target.value)} aria-label="État au retour" className={`${CLASSE_CHAMP} h-9`}>
            <option value="bon">Bon état</option>
            <option value="endommage">Endommagé</option>
            <option value="perdu">Perdu</option>
          </select>
          {caution > 0 && (
            <input
              value={retenue}
              onChange={(e) => setRetenue(e.target.value)}
              inputMode="numeric"
              aria-label="Retenue sur caution"
              placeholder="Retenue sur caution"
              className={`${CLASSE_CHAMP} chiffres h-9`}
            />
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={op.enCours}
              onClick={() =>
                op.lancer(
                  () => restituer(id, etat, Number(retenue.replace(/[\s  ]/g, "") || "0")),
                  () => setPanneau(null),
                )
              }
              className={`${PETIT} bg-marque-600 text-white`}
            >
              Valider le retour
            </button>
            <button type="button" onClick={() => setPanneau(null)} className={`${PETIT} text-[var(--encre-faible)]`}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}

export function ChangerEtatRessource({
  id,
  statut,
}: {
  id: string;
  statut: "active" | "maintenance" | "retiree";
}) {
  const op = useOperation();
  return (
    <div>
      <select
        value={statut}
        disabled={op.enCours}
        onChange={(e) =>
          op.lancer(() => changerStatutRessource(id, e.target.value as "active" | "maintenance" | "retiree"))
        }
        aria-label="État de la ressource"
        className={`${CLASSE_CHAMP} h-9 w-40`}
      >
        <option value="active">Louable</option>
        <option value="maintenance">En maintenance</option>
        <option value="retiree">Retirée du parc</option>
      </select>
      {op.resultat && !op.resultat.ok && <Retour resultat={op.resultat} />}
    </div>
  );
}

export function BoutonPassage({ id, desactive }: { id: string; desactive: boolean }) {
  const op = useOperation();
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={op.enCours || desactive}
        onClick={() => op.lancer(() => enregistrerPassage(id))}
        className={`${PETIT} bg-marque-600 text-white`}
      >
        Entrée
      </button>
      {op.resultat && <Retour resultat={op.resultat} />}
    </div>
  );
}
