"use client";

import { useEffect, useRef, useState } from "react";

import { monnaieARendre, resteAPayer, type LignePanier } from "@/lib/caisse/panier";
import { MOYENS_PAIEMENT, type MoyenPaiementId } from "@/lib/fixtures/catalogue";
import { fmt } from "./ecran-caisse";

interface Reglement {
  moyen: MoyenPaiementId;
  nom: string;
  montant: number;
  reference?: string;
}

interface Props {
  net: number;
  lignes: LignePanier[];
  onAnnuler: () => void;
  onValider: () => void;
}

export function ModalePaiement({ net, lignes, onAnnuler, onValider }: Props) {
  const [reglements, setReglements] = useState<Reglement[]>([]);
  const [moyen, setMoyen] = useState<MoyenPaiementId>("especes");
  const [saisie, setSaisie] = useState("");
  const [reference, setReference] = useState("");
  const dialogue = useRef<HTMLDivElement>(null);

  const regle = reglements.reduce((somme, r) => somme + r.montant, 0);
  const reste = resteAPayer(net, regle);
  const montantSaisi = Number(saisie) || 0;

  // En espèces, le caissier annonce la monnaie. Ce champ n'existe pas chez le
  // concurrent, et c'est la première source d'écart à la clôture de caisse.
  const rendu = monnaieARendre(reste, montantSaisi);
  const moyenActif = MOYENS_PAIEMENT.find((m) => m.id === moyen)!;
  const soldé = reste === 0 && reglements.length > 0;

  useEffect(() => {
    function auClavier(event: KeyboardEvent) {
      if (event.key === "Escape") onAnnuler();
    }
    document.addEventListener("keydown", auClavier);
    dialogue.current?.focus();
    return () => document.removeEventListener("keydown", auClavier);
  }, [onAnnuler]);

  function taper(touche: string) {
    if (touche === "C") return setSaisie("");
    if (touche === "←") return setSaisie((s) => s.slice(0, -1));
    setSaisie((s) => (s === "0" ? touche : s + touche));
  }

  function enregistrerReglement() {
    const montant = montantSaisi > 0 ? Math.min(montantSaisi, reste) : reste;
    if (montant <= 0) return;

    setReglements((liste) => [
      ...liste,
      {
        moyen,
        nom: moyenActif.nom,
        montant,
        reference: reference.trim() || undefined,
      },
    ]);
    setSaisie("");
    setReference("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Encaissement"
    >
      <div
        ref={dialogue}
        tabIndex={-1}
        className="flex max-h-dvh w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] outline-none sm:rounded-2xl"
      >
        {/* ------------------------------------------------------- en-tête */}
        <div className="flex shrink-0 items-baseline justify-between gap-4 border-b border-[var(--filet)] px-5 py-3">
          <div>
            <h2 className="text-base font-semibold">Encaissement</h2>
            <p className="text-xs text-[var(--encre-faible)]">
              {lignes.length} ligne{lignes.length > 1 ? "s" : ""} ·{" "}
              {lignes.reduce((s, l) => s + l.quantite, 0)} article
              {lignes.reduce((s, l) => s + l.quantite, 0) > 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onAnnuler}
            className="rounded-lg px-2 py-1 text-sm text-[var(--encre-faible)] hover:bg-[var(--surface-creuse)]"
          >
            Annuler
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto sm:grid-cols-2">
          {/* ------------------------------------------- moyens & montants */}
          <div className="space-y-3 border-b border-[var(--filet)] p-4 sm:border-b-0 sm:border-r">
            <div className="rounded-xl bg-[var(--surface-creuse)] p-3">
              <p className="text-xs text-[var(--encre-faible)]">Reste à payer</p>
              <p className="chiffres text-3xl font-bold">
                {fmt(reste)}{" "}
                <span className="text-base font-medium text-[var(--encre-faible)]">
                  FCFA
                </span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {MOYENS_PAIEMENT.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMoyen(m.id)}
                  className={`sans-selection h-cible rounded-lg border px-1 text-xs font-semibold ${
                    moyen === m.id
                      ? "border-marque-600 bg-marque-600 text-white"
                      : "border-[var(--filet)] text-[var(--encre-douce)]"
                  }`}
                >
                  {m.nom}
                </button>
              ))}
            </div>

            {moyenActif.demandeReference && (
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={`Référence ${moyenActif.nom}`}
                className="h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3 text-sm outline-none focus:border-marque-500"
              />
            )}

            {reglements.length > 0 && (
              <ul className="space-y-1 border-t border-[var(--filet)] pt-2 text-sm">
                {reglements.map((r, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">
                      {r.nom}
                      {r.reference && (
                        <span className="ml-1 text-xs text-[var(--encre-faible)]">
                          {r.reference}
                        </span>
                      )}
                    </span>
                    <span className="chiffres shrink-0 font-semibold">
                      {fmt(r.montant)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* -------------------------------------------------- pavé saisie */}
          <div className="flex flex-col gap-2 p-4">
            <div className="rounded-xl border border-[var(--filet)] px-3 py-2">
              <p className="text-xs text-[var(--encre-faible)]">Montant reçu</p>
              <p className="chiffres text-2xl font-bold">
                {saisie === "" ? fmt(reste) : fmt(montantSaisi)}
              </p>
            </div>

            {rendu > 0 && (
              <div className="rounded-xl bg-valide-50 px-3 py-2">
                <p className="text-xs font-medium text-valide-600">Monnaie à rendre</p>
                <p className="chiffres text-2xl font-bold text-valide-600">
                  {fmt(rendu)}
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map(
                (touche) => (
                  <button
                    key={touche}
                    type="button"
                    onClick={() => taper(touche)}
                    className="sans-selection h-touche rounded-lg border border-[var(--filet)] text-lg font-semibold hover:bg-[var(--surface-creuse)]"
                  >
                    {touche}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------- actions */}
        <div className="shrink-0 border-t border-[var(--filet)] p-4">
          {soldé ? (
            <button
              type="button"
              onClick={onValider}
              className="sans-selection h-touche w-full rounded-xl bg-valide-500 text-base font-bold text-white hover:bg-valide-600"
            >
              Valider et imprimer le ticket
            </button>
          ) : (
            <button
              type="button"
              onClick={enregistrerReglement}
              className="sans-selection h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700"
            >
              Encaisser {fmt(montantSaisi > 0 ? Math.min(montantSaisi, reste) : reste)} en{" "}
              {moyenActif.nom.toLowerCase()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
