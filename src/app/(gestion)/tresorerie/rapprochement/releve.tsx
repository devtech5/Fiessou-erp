"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP_COMPACT, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { comptabiliserLigne, depointer, pointer, pointerAuto } from "@/modules/tresorerie/actions";
import type { LigneReleveVue } from "@/modules/tresorerie/requetes";

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const date = (iso: string) => JOUR.format(new Date(`${iso}T00:00:00Z`));
const signe = (n: number) => `${n > 0 ? "+" : "−"} ${fmt(Math.abs(n))}`;

interface Libre {
  id: string;
  date: string;
  montant: number;
  libelle: string;
  numero: string;
}

/**
 * Relevé et écritures, face à face. Une ligne non pointée propose les
 * écritures libres du même montant ; s'il n'y en a pas, c'est que la banque a
 * passé quelque chose que la comptabilité ignore — on le comptabilise.
 */
export function Releve({ compteId, releve, libres }: { compteId: string; releve: LigneReleveVue[]; libres: Libre[] }) {
  const op = useOperation();
  const [choix, setChoix] = useState<Record<string, string>>({});

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={op.enCours}
          onClick={() => op.lancer(() => pointerAuto(compteId))}
          className="h-cible rounded-lg bg-marque-500 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Pointer automatiquement
        </button>
        <span className="text-xs text-[var(--encre-faible)]">Même montant, à trois jours près.</span>
      </div>
      {op.resultat && (
        <div className="mb-3">
          <Retour resultat={op.resultat} />
        </div>
      )}

      {releve.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-base font-semibold">Relevé de la banque</h2>
          <Tableau>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Libellé</Th>
                <Th aligne="droite">Montant</Th>
                <Th>Pointage</Th>
              </tr>
            </thead>
            <tbody>
              {releve.map((l) => {
                const candidats = libres.filter((e) => e.montant === l.montant);
                return (
                  <tr key={l.id} className={l.pointee ? undefined : "bg-alerte-50/40"}>
                    <Td chiffres>{date(l.date)}</Td>
                    <Td>
                      <span className="block max-w-[320px] truncate text-sm">{l.libelle}</span>
                    </Td>
                    <Td aligne="droite" chiffres fort>
                      <span className={l.montant > 0 ? "text-valide-600" : ""}>{signe(l.montant)}</span>
                    </Td>
                    <Td>
                      {l.pointee ? (
                        <span className="flex flex-wrap items-center gap-1.5 text-xs">
                          <Pastille ton="valide">{l.ecriture ? "Comptabilisée" : "Pointée"}</Pastille>
                          <span className="chiffres">{l.pointee.numero}</span>
                          {!l.ecriture && (
                            <button type="button" disabled={op.enCours} onClick={() => op.lancer(() => depointer(l.id))} className="text-[var(--encre-faible)] hover:underline">
                              dépointer
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {candidats.length > 0 && (
                            <>
                              <select
                                value={choix[l.id] ?? candidats[0].id}
                                onChange={(e) => setChoix({ ...choix, [l.id]: e.target.value })}
                                aria-label="Écriture à pointer"
                                className={`${CLASSE_CHAMP_COMPACT} h-8 max-w-[220px] text-xs`}
                              >
                                {candidats.map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.numero} · {date(e.date)} · {e.libelle.slice(0, 40)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={op.enCours}
                                onClick={() => op.lancer(() => pointer(l.id, choix[l.id] ?? candidats[0].id))}
                                className="rounded-lg bg-valide-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                Pointer
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            disabled={op.enCours}
                            onClick={() => op.lancer(() => comptabiliserLigne(l.id))}
                            title={l.montant < 0 ? "Passer en frais bancaires (631)" : "Passer en produits financiers (771)"}
                            className="rounded-lg border border-[var(--filet)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--surface-creuse)] disabled:opacity-50"
                          >
                            {l.montant < 0 ? "Comptabiliser en frais" : "Comptabiliser en produit"}
                          </button>
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tableau>
        </section>
      )}

      {libres.length > 0 && (
        <section>
          <h2 className="mb-1 text-base font-semibold">Écritures que la banque n&apos;a pas encore passées</h2>
          <p className="mb-2 text-xs text-[var(--encre-faible)]">Chèque remis mais pas encaissé, versement d&apos;hier, ou relevé pas encore importé.</p>
          <Tableau>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Écriture</Th>
                <Th>Libellé</Th>
                <Th aligne="droite">Montant</Th>
              </tr>
            </thead>
            <tbody>
              {libres.map((e) => (
                <tr key={e.id}>
                  <Td chiffres>{date(e.date)}</Td>
                  <Td chiffres fort>{e.numero}</Td>
                  <Td>
                    <span className="block max-w-[360px] truncate">{e.libelle}</span>
                  </Td>
                  <Td aligne="droite" chiffres>
                    {signe(e.montant)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        </section>
      )}
    </>
  );
}
