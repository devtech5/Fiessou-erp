"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP_COMPACT, Pastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { regler } from "@/modules/achats/actions";
import { etatDette } from "@/modules/achats/calcul";
import type { FactureVue } from "@/modules/achats/requetes";

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const date = (iso: string) => JOUR.format(new Date(`${iso}T00:00:00Z`));

interface Compte {
  id: string;
  nom: string;
  nature: string;
  solde: number;
}

/** Échéancier, fournisseur par fournisseur, avec le règlement sur place. */
export function ListeDettes({ factures, comptes, payer, aujourdhui }: { factures: FactureVue[]; comptes: Compte[]; payer: boolean; aujourdhui: string }) {
  const op = useOperation();
  const [saisie, setSaisie] = useState<{ id: string; montant: string; compte: string; date: string; reference: string } | null>(null);

  const parFournisseur = new Map<string, FactureVue[]>();
  for (const f of factures) parFournisseur.set(f.fournisseur, [...(parFournisseur.get(f.fournisseur) ?? []), f]);
  const groupes = [...parFournisseur.entries()].sort((a, b) => (a[1][0].echeance < b[1][0].echeance ? -1 : 1));

  return (
    <>
      {op.resultat && (
        <div className="mb-3">
          <Retour resultat={op.resultat} />
        </div>
      )}
      <div className="space-y-4">
        {groupes.map(([fournisseur, liste]) => (
          <section key={fournisseur} className="overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
            <header className="flex items-baseline justify-between gap-3 border-b border-[var(--filet)] bg-[var(--surface-creuse)] px-4 py-2.5">
              <h2 className="text-sm font-semibold">{fournisseur}</h2>
              <span className="chiffres text-sm font-bold">{fmt(liste.reduce((s, f) => s + f.reste, 0))} F</span>
            </header>
            <ul className="divide-y divide-[var(--filet)]">
              {liste.map((f) => {
                const etat = etatDette(f.reste, f.echeance, aujourdhui);
                return (
                  <li key={f.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="chiffres text-sm">
                          <strong>{f.numero}</strong> · n° {f.reference} · {fmt(f.totalTtc)} F TTC
                          {f.regle > 0 && ` · ${fmt(f.regle)} F déjà payés`}
                        </p>
                        <p className="chiffres text-xs text-[var(--encre-faible)]">
                          Échéance {date(f.echeance)}
                          {f.reglements.map((r) => ` · ${r.numero} ${fmt(r.montant)} F (${r.compte})`).join("")}
                        </p>
                      </div>
                      <Pastille ton={etat === "echue" ? "danger" : etat === "bientot" ? "alerte" : "neutre"}>
                        {etat === "echue" ? "Échue" : etat === "bientot" ? "Cette semaine" : "À venir"} · reste {fmt(f.reste)} F
                      </Pastille>
                      {payer && saisie?.id !== f.id && comptes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSaisie({ id: f.id, montant: String(f.reste), compte: comptes.find((c) => c.nature === "banque")?.id ?? comptes[0].id, date: aujourdhui, reference: "" })}
                          className="rounded-lg bg-marque-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Régler
                        </button>
                      )}
                    </div>
                    {saisie?.id === f.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          op.lancer(
                            () =>
                              regler(f.id, {
                                montant: Number(saisie.montant.replace(/[\s  ]/g, "")),
                                compteTresorerieId: saisie.compte,
                                date: saisie.date,
                                reference: saisie.reference || null,
                              }),
                            () => setSaisie(null),
                          );
                        }}
                        className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--filet)] bg-[var(--surface-creuse)] p-3"
                      >
                        <label className="text-xs">
                          <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Montant</span>
                          <input inputMode="numeric" value={saisie.montant} onChange={(e) => setSaisie({ ...saisie, montant: e.target.value })} className={`${CLASSE_CHAMP_COMPACT} chiffres h-9 w-32 text-right`} />
                        </label>
                        <label className="text-xs">
                          <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Payé depuis</span>
                          <select value={saisie.compte} onChange={(e) => setSaisie({ ...saisie, compte: e.target.value })} className={`${CLASSE_CHAMP_COMPACT} h-9`}>
                            {comptes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nom} — {fmt(c.solde)} F
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs">
                          <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Date</span>
                          <input type="date" value={saisie.date} onChange={(e) => setSaisie({ ...saisie, date: e.target.value })} className={`${CLASSE_CHAMP_COMPACT} h-9`} />
                        </label>
                        <label className="text-xs">
                          <span className="mb-1 block font-semibold text-[var(--encre-faible)]">Référence</span>
                          <input value={saisie.reference} onChange={(e) => setSaisie({ ...saisie, reference: e.target.value })} placeholder="N° de chèque, de virement" className={`${CLASSE_CHAMP_COMPACT} h-9`} />
                        </label>
                        <button type="submit" disabled={op.enCours} className="h-9 rounded-lg bg-marque-500 px-4 text-sm font-semibold text-white disabled:opacity-50">
                          {op.enCours ? "Paiement…" : "Payer"}
                        </button>
                        <button type="button" onClick={() => setSaisie(null)} className="h-9 text-sm text-[var(--encre-faible)] hover:underline">
                          Retour
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {payer && comptes.length === 0 && (
        <p className="mt-4 text-sm text-alerte-600">Aucun compte de trésorerie déclaré : ouvrez-en un dans Trésorerie pour régler les fournisseurs.</p>
      )}
    </>
  );
}
