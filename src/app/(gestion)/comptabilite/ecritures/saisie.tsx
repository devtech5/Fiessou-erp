"use client";

import { useState } from "react";

import { BoutonPrincipal, BoutonSecondaire } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { JOURNAUX } from "@/lib/fixtures/comptabilite";

/** Comptes de charge et de produit les plus utilisés au quotidien. */
const COMPTES_COURANTS = [
  { numero: "601", intitule: "Achats de marchandises", sens: "charge" },
  { numero: "605", intitule: "Autres achats", sens: "charge" },
  { numero: "6221", intitule: "Locations", sens: "charge" },
  { numero: "6241", intitule: "Entretien et réparations", sens: "charge" },
  { numero: "627", intitule: "Publicité et relations publiques", sens: "charge" },
  { numero: "6281", intitule: "Frais de télécommunications", sens: "charge" },
  { numero: "631", intitule: "Frais bancaires", sens: "charge" },
  { numero: "661", intitule: "Rémunérations du personnel", sens: "charge" },
  { numero: "701", intitule: "Ventes de marchandises", sens: "produit" },
  { numero: "706", intitule: "Services vendus", sens: "produit" },
] as const;

/**
 * Saisie d'écriture.
 *
 * L'utilisateur ne choisit qu'un journal et un seul compte — de charge ou de
 * produit. La contrepartie et le sens du débit et du crédit se déduisent du
 * journal. C'est la meilleure idée du produit concurrent, et la seule
 * abstraction qui rende la comptabilité tenable pour un commerçant qui n'est
 * pas comptable.
 *
 * La partie double reste affichée en permanence : on ne cache pas l'écriture,
 * on évite seulement d'en faire saisir les deux côtés.
 */
export function SaisieEcriture() {
  const [journal, setJournal] = useState(JOURNAUX[2]); // Caisse par défaut
  const [compte, setCompte] = useState<(typeof COMPTES_COURANTS)[number]>(
    COMPTES_COURANTS[1],
  );
  const [montant, setMontant] = useState(0);
  const [libelle, setLibelle] = useState("");

  // Un compte de charge se débite, un compte de produit se crédite. La
  // contrepartie du journal prend l'autre sens, systématiquement.
  const compteEstDebit = compte.sens === "charge";

  const lignes = compteEstDebit
    ? [
        { compte: `${compte.numero} — ${compte.intitule}`, debit: montant, credit: 0 },
        { compte: journal.contrepartie, debit: 0, credit: montant },
      ]
    : [
        { compte: journal.contrepartie, debit: montant, credit: 0 },
        { compte: `${compte.numero} — ${compte.intitule}`, debit: 0, credit: montant },
      ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      {/* --------------------------------------------------- le formulaire */}
      <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="mb-4 text-base font-semibold">Nouvelle écriture</h2>

        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">
            Journal
          </legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {JOURNAUX.map((j) => (
              <button
                key={j.code}
                type="button"
                onClick={() => setJournal(j)}
                className={`h-cible rounded-lg border text-sm font-semibold ${
                  journal.code === j.code
                    ? "border-marque-600 bg-marque-600 text-white"
                    : "border-[var(--filet)] text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                {j.code}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--encre-faible)]">
            {journal.libelle} · contrepartie {journal.contrepartie}
          </p>
        </fieldset>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
            Libellé
          </span>
          <input
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex : facture électricité CIE août"
            className="h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-sm outline-none focus:border-marque-500"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
            Compte
          </span>
          <select
            value={compte.numero}
            onChange={(e) =>
              setCompte(
                COMPTES_COURANTS.find((c) => c.numero === e.target.value)!,
              )
            }
            className="h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-sm outline-none focus:border-marque-500"
          >
            {COMPTES_COURANTS.map((c) => (
              <option key={c.numero} value={c.numero}>
                {c.numero} — {c.intitule}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
            Montant
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              value={montant || ""}
              onChange={(e) => setMontant(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              placeholder="0"
              className="chiffres h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-right text-sm outline-none focus:border-marque-500"
            />
            <span className="shrink-0 text-sm text-[var(--encre-faible)]">FCFA</span>
          </div>
          {/* Le franc CFA n'a pas de centime : la saisie est arrondie à l'entier. */}
        </label>

        <div className="flex gap-2">
          <BoutonSecondaire>Scanner un reçu</BoutonSecondaire>
          <BoutonPrincipal>Enregistrer</BoutonPrincipal>
        </div>
      </div>

      {/* ------------------------------------------------ la partie double */}
      <aside className="h-fit rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
        <h2 className="text-base font-semibold">Écriture générée</h2>
        <p className="mt-0.5 text-xs text-[var(--encre-faible)]">
          Vous saisissez un compte, Fiessou écrit les deux lignes.
        </p>

        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--filet)]">
              <th className="pb-1.5 text-left text-xs font-semibold text-[var(--encre-faible)]">
                Compte
              </th>
              <th className="pb-1.5 text-right text-xs font-semibold text-[var(--encre-faible)]">
                Débit
              </th>
              <th className="pb-1.5 text-right text-xs font-semibold text-[var(--encre-faible)]">
                Crédit
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, index) => (
              <tr key={index} className="border-b border-[var(--filet)]">
                <td className="py-2 pr-2 text-xs">{ligne.compte}</td>
                <td className="chiffres py-2 text-right">
                  {ligne.debit > 0 ? fmt(ligne.debit) : "—"}
                </td>
                <td className="chiffres py-2 text-right">
                  {ligne.credit > 0 ? fmt(ligne.credit) : "—"}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2 text-xs font-semibold">Totaux</td>
              <td className="chiffres py-2 text-right font-bold">{fmt(montant)}</td>
              <td className="chiffres py-2 text-right font-bold">{fmt(montant)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 rounded-lg bg-valide-50 px-3 py-2 text-xs font-medium text-valide-600">
          Équilibrée — débit égal au crédit
        </p>
      </aside>
    </div>
  );
}
