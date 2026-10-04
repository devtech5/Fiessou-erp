"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP_COMPACT, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { annulerVirement, recevoirVirement } from "@/modules/tresorerie/actions";
import type { VirementVue } from "@/modules/tresorerie/requetes";

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const date = (iso: string) => JOUR.format(new Date(`${iso}T00:00:00Z`));

export function ListeVirements({ virements, saisir, aujourdhui }: { virements: VirementVue[]; saisir: boolean; aujourdhui: string }) {
  const op = useOperation();
  const [action, setAction] = useState<{ id: string; type: "recevoir" | "annuler"; valeur: string } | null>(null);

  return (
    <>
      {op.resultat && (
        <div className="mb-3">
          <Retour resultat={op.resultat} />
        </div>
      )}
      <Tableau>
        <thead>
          <tr>
            <Th>Virement</Th>
            <Th>De → vers</Th>
            <Th aligne="droite">Montant</Th>
            <Th>Envoyé</Th>
            <Th>Arrivée</Th>
            <Th>Écritures</Th>
          </tr>
        </thead>
        <tbody>
          {virements.map((v) => (
            <tr key={v.id} className={v.statut === "annule" ? "opacity-60" : undefined}>
              <Td chiffres fort>
                {v.numero}
                {v.reference && <span className="block text-xs font-normal text-[var(--encre-faible)]">{v.reference}</span>}
              </Td>
              <Td>
                <span className="block text-sm">
                  {v.source} → {v.destination}
                </span>
                {v.motif && <span className="block max-w-[260px] truncate text-xs text-[var(--encre-faible)]">{v.motif}</span>}
              </Td>
              <Td aligne="droite" chiffres fort>
                {fmt(v.montant)}
                {v.frais > 0 && <span className="block text-xs font-normal text-[var(--encre-faible)]">+ {fmt(v.frais)} de frais</span>}
              </Td>
              <Td chiffres>
                {date(v.dateEnvoi)}
                {v.envoyePar && <span className="block text-xs text-[var(--encre-faible)]">{v.envoyePar}</span>}
              </Td>
              <Td>
                {v.statut === "recu" && <Pastille ton="valide">Reçu le {date(v.dateReception!)}</Pastille>}
                {v.statut === "annule" && <Pastille ton="danger">Annulé</Pastille>}
                {v.statut === "en_transit" &&
                  (action?.id === v.id ? (
                    <form
                      className="flex flex-wrap items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        op.lancer(
                          () => (action.type === "recevoir" ? recevoirVirement(v.id, action.valeur) : annulerVirement(v.id, action.valeur)),
                          () => setAction(null),
                        );
                      }}
                    >
                      {action.type === "recevoir" ? (
                        <input
                          type="date"
                          value={action.valeur}
                          min={v.dateEnvoi}
                          onChange={(e) => setAction({ ...action, valeur: e.target.value })}
                          aria-label="Date d'arrivée"
                          className={`${CLASSE_CHAMP_COMPACT} h-9`}
                        />
                      ) : (
                        <input
                          autoFocus
                          value={action.valeur}
                          onChange={(e) => setAction({ ...action, valeur: e.target.value })}
                          placeholder="Motif de l'annulation"
                          aria-label="Motif de l'annulation"
                          className={`${CLASSE_CHAMP_COMPACT} h-9`}
                        />
                      )}
                      <button
                        type="submit"
                        disabled={op.enCours || (action.type === "annuler" && action.valeur.trim().length < 3)}
                        className={`h-9 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50 ${action.type === "recevoir" ? "bg-valide-500" : "bg-danger-500"}`}
                      >
                        Confirmer
                      </button>
                      <button type="button" onClick={() => setAction(null)} className="text-xs text-[var(--encre-faible)] hover:underline">
                        Retour
                      </button>
                    </form>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pastille ton="alerte">En route</Pastille>
                      {saisir && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAction({ id: v.id, type: "recevoir", valeur: aujourdhui })}
                            className="rounded-lg bg-valide-500 px-2.5 py-1 text-xs font-semibold text-white"
                          >
                            Constater l&apos;arrivée
                          </button>
                          <button
                            type="button"
                            onClick={() => setAction({ id: v.id, type: "annuler", valeur: "" })}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-danger-600 hover:bg-danger-50"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </span>
                  ))}
              </Td>
              <Td chiffres>
                <span className="block text-xs">{v.ecritureEnvoi ?? "—"}</span>
                {v.ecritureReception && <span className="block text-xs">{v.ecritureReception}</span>}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </>
  );
}
