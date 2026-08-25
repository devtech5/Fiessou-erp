"use client";

import { useState } from "react";

import { BoutonPrincipal, Pastille } from "@/components/ui/primitives";
import {
  SEUIL_DIRECTION,
  circuitImpossible,
  construireCircuit,
} from "@/lib/approbation/circuit";
import { fmt } from "@/lib/format";
import {
  ANNUAIRE,
  CAISSES,
  LIBELLE_NATURE,
  type NatureDepense,
} from "@/lib/fixtures/caisse-depenses";

const NATURES = Object.keys(LIBELLE_NATURE) as NatureDepense[];

/**
 * Demande de bon de caisse.
 *
 * Le circuit se recalcule à chaque frappe et reste affiché : l'émetteur voit
 * qui devra signer avant de soumettre. C'est ce qui évite la demande déposée un
 * vendredi soir dont on découvre le lundi qu'elle attendait la direction.
 */
export function DemandeBon() {
  const [emetteurId, setEmetteurId] = useState("p4");
  const [caisseId, setCaisseId] = useState(CAISSES[0].id);
  const [nature, setNature] = useState<NatureDepense>("achat");
  const [objet, setObjet] = useState("");
  const [montant, setMontant] = useState(0);

  const emetteur = ANNUAIRE.find((p) => p.id === emetteurId)!;
  const caisse = CAISSES.find((c) => c.id === caisseId)!;
  const circuit = construireCircuit(emetteur, montant, ANNUAIRE);

  const bloque = circuitImpossible(circuit);
  const soldeInsuffisant = montant > caisse.solde;
  const soumissible = montant > 0 && objet.trim().length > 0 && !bloque;

  return (
    <section className="mb-6 grid gap-4 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
      {/* ------------------------------------------------------ le formulaire */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Nouveau bon de caisse</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
              Émetteur
            </span>
            <select
              value={emetteurId}
              onChange={(e) => setEmetteurId(e.target.value)}
              className="h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-sm outline-none focus:border-marque-500"
            >
              {ANNUAIRE.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} — {p.fonction}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
              Caisse
            </span>
            <select
              value={caisseId}
              onChange={(e) => setCaisseId(e.target.value)}
              className="h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-sm outline-none focus:border-marque-500"
            >
              {CAISSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} — {fmt(c.solde)} FCFA
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
              Nature
            </span>
            <select
              value={nature}
              onChange={(e) => setNature(e.target.value as NatureDepense)}
              className="h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-sm outline-none focus:border-marque-500"
            >
              {NATURES.map((n) => (
                <option key={n} value={n}>
                  {LIBELLE_NATURE[n]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
              Montant
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={500}
                inputMode="numeric"
                value={montant || ""}
                onChange={(e) =>
                  setMontant(Math.max(0, Math.round(Number(e.target.value) || 0)))
                }
                placeholder="0"
                className="chiffres h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-right text-sm font-bold outline-none focus:border-marque-500"
              />
              <span className="shrink-0 text-xs text-[var(--encre-faible)]">FCFA</span>
            </div>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--encre-faible)]">
              Objet de la dépense
            </span>
            <input
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Ex : carburant pour les livraisons du jour"
              className="h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-sm outline-none focus:border-marque-500"
            />
          </label>
        </div>

        {soldeInsuffisant && (
          <p className="mt-3 rounded-lg bg-alerte-50 px-3 py-2.5 text-xs font-medium text-alerte-600">
            La {caisse.nom.toLowerCase()} ne contient que {fmt(caisse.solde)} FCFA.
            Le bon peut être approuvé, mais il faudra réalimenter la caisse avant
            de décaisser.
          </p>
        )}

        <div className="mt-4">
          <BoutonPrincipal>
            {soumissible ? "Soumettre à validation" : "Complétez la demande"}
          </BoutonPrincipal>
        </div>
      </div>

      {/* ----------------------------------------------- le circuit calculé */}
      <aside className="rounded-lg bg-[var(--surface-creuse)] p-4">
        <h3 className="text-sm font-semibold">Circuit de validation</h3>
        <p className="mt-0.5 text-xs text-[var(--encre-faible)]">
          Recalculé selon l&apos;émetteur et le montant
        </p>

        {bloque ? (
          <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2.5 text-xs font-medium text-danger-600">
            Aucun valideur disponible pour {emetteur.nom}. Un dirigeant ne peut pas
            approuver son propre bon : désignez un co-validateur.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {circuit.map((etape, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[11px] font-bold text-[var(--encre-faible)]"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {etape.valideurNom}
                  </span>
                  <span className="block text-xs text-[var(--encre-faible)]">
                    {etape.role === "superieur"
                      ? "Supérieur direct"
                      : "Direction"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-3 border-t border-[var(--filet)] pt-2.5 text-xs text-[var(--encre-faible)]">
          {emetteur.superieurId === null ? (
            <>
              {emetteur.nom} n&apos;a pas de supérieur : sa demande part
              directement en direction, quel que soit le montant.
            </>
          ) : montant > SEUIL_DIRECTION ? (
            <>
              Au-delà de {fmt(SEUIL_DIRECTION)} FCFA, la direction valide en plus
              du supérieur.
            </>
          ) : (
            <>
              Jusqu&apos;à {fmt(SEUIL_DIRECTION)} FCFA, le supérieur direct suffit.
            </>
          )}
        </p>

        {montant > 0 && (
          <p className="mt-2 text-xs">
            <Pastille ton={montant > SEUIL_DIRECTION ? "alerte" : "neutre"}>
              {circuit.length} validation{circuit.length > 1 ? "s" : ""} requise
              {circuit.length > 1 ? "s" : ""}
            </Pastille>
          </p>
        )}
      </aside>
    </section>
  );
}
