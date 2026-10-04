"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { CLASSE_CHAMP } from "@/components/ui/primitives";
import {
  annulerContrat,
  changerStatutRessource,
  enregistrerPassage,
  remettre,
  restituer,
  type Resultat,
} from "@/modules/reservations/actions";

/** Message de retour d'une opération, lisible et annoncé. */
function Retour({ resultat }: { resultat: Resultat | null }) {
  if (!resultat) return null;
  return (
    <p
      role={resultat.ok ? "status" : "alert"}
      className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${
        resultat.ok ? "bg-valide-50 text-valide-600" : "bg-danger-50 text-danger-600"
      }`}
    >
      {resultat.message}
    </p>
  );
}

/**
 * Formulaire repliable branché sur une action serveur à FormData.
 * Se referme et se vide sur un succès ; garde la saisie sur un refus.
 */
export function FormulaireRepliable({
  libelle,
  titre,
  action,
  children,
  desactive,
}: {
  libelle: string;
  titre: string;
  action: (donnees: FormData) => Promise<Resultat>;
  children: ReactNode;
  desactive?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const formulaire = useRef<HTMLFormElement>(null);
  const routeur = useRouter();

  if (!ouvert) {
    return (
      <div className="flex flex-col items-end">
        <button
          type="button"
          disabled={desactive}
          onClick={() => {
            setOuvert(true);
            setResultat(null);
          }}
          className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
        >
          {libelle}
        </button>
        {resultat?.ok && <Retour resultat={resultat} />}
      </div>
    );
  }

  return (
    <form
      ref={formulaire}
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        demarrer(async () => {
          const r = await action(donnees);
          setResultat(r);
          if (r.ok) {
            setOuvert(false);
            routeur.refresh();
          }
        });
      }}
      className="mb-5 w-full rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 text-left"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{titre}</h2>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-sm text-[var(--encre-faible)] hover:underline"
        >
          Annuler
        </button>
      </div>
      {children}
      {resultat && !resultat.ok && <Retour resultat={resultat} />}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={enCours}
          className="h-cible rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function useOperation() {
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();
  return {
    resultat,
    enCours,
    lancer(op: () => Promise<Resultat>, apres?: () => void) {
      setResultat(null);
      demarrer(async () => {
        const r = await op();
        setResultat(r);
        if (r.ok) {
          apres?.();
          routeur.refresh();
        }
      });
    },
  };
}

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
    <div className="min-w-48 text-left">
      {panneau === null && (
        <div className="flex flex-wrap justify-end gap-1.5">
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
              className={`${PETIT} bg-danger-600 text-white`}
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
