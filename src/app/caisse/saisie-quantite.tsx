"use client";

import { useEffect, useRef, useState } from "react";

import { fmt } from "@/lib/format";
import {
  UNITES,
  ajusterAuPas,
  montantLigne,
  versQuantite,
  type CodeUnite,
} from "@/lib/quantite";

interface Props {
  designation: string;
  prixUnitaire: number;
  unite: CodeUnite;
  /** Stock restant, en millièmes. */
  stock: number;
  onAnnuler: () => void;
  onValider: (quantite: number) => void;
}

/**
 * Saisie d'une quantité fractionnaire.
 *
 * Un article au poids ne s'ajoute pas d'un clic : le caissier lit la balance et
 * saisit ce qu'elle affiche. Sans cet écran, une poissonnerie vend un kilo à
 * chaque fois, quel que soit le poisson posé sur le plateau.
 *
 * Le montant se recalcule à chaque frappe et reste sous les yeux : c'est le
 * chiffre que le client va entendre, il doit apparaître avant la validation et
 * non après.
 */
export function SaisieQuantite({
  designation,
  prixUnitaire,
  unite,
  stock,
  onAnnuler,
  onValider,
}: Props) {
  const [saisie, setSaisie] = useState("");
  const dialogue = useRef<HTMLDivElement>(null);
  const info = UNITES[unite];

  const valeur = Number(saisie.replace(",", ".")) || 0;
  const quantite = versQuantite(valeur);
  const montant = montantLigne(prixUnitaire, quantite);
  const depasseStock = quantite > stock;
  const valide = quantite > 0 && !depasseStock;

  useEffect(() => {
    function auClavier(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") onAnnuler();
    }
    document.addEventListener("keydown", auClavier);
    dialogue.current?.focus();
    return () => document.removeEventListener("keydown", auClavier);
  }, [onAnnuler]);

  function taper(touche: string) {
    if (touche === "C") return setSaisie("");
    if (touche === "←") return setSaisie((s) => s.slice(0, -1));
    // Une seule virgule, et trois décimales au plus : au-delà on ne pèse plus.
    if (touche === ",") {
      return setSaisie((s) => (s.includes(",") ? s : s === "" ? "0," : s + ","));
    }
    setSaisie((s) => {
      const [, decimales] = s.split(",");
      if (decimales !== undefined && decimales.length >= 3) return s;
      return s + touche;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Quantité pour ${designation}`}
    >
      <div
        ref={dialogue}
        tabIndex={-1}
        className="w-full max-w-md rounded-t-2xl bg-[var(--surface)] p-5 outline-none sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug">{designation}</h2>
            <p className="chiffres text-xs text-[var(--encre-faible)]">
              {fmt(prixUnitaire)} FCFA / {info.abrege} · {fmt(stock / 1000)}{" "}
              {info.abrege} en stock
            </p>
          </div>
          <button
            type="button"
            onClick={onAnnuler}
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-[var(--encre-faible)] hover:bg-[var(--surface-creuse)]"
          >
            Annuler
          </button>
        </div>

        <div className="mb-3 rounded-xl border border-[var(--filet)] px-4 py-3">
          <p className="text-xs text-[var(--encre-faible)]">
            Quantité en {info.libelle.toLowerCase()}
          </p>
          <p className="chiffres text-3xl font-bold">
            {saisie === "" ? "0" : saisie}
            <span className="ml-1.5 text-base font-medium text-[var(--encre-faible)]">
              {info.abrege}
            </span>
          </p>
        </div>

        <div
          className={`mb-3 rounded-xl px-4 py-3 ${
            depasseStock ? "bg-danger-50" : "bg-[var(--surface-creuse)]"
          }`}
        >
          <p
            className={`text-xs font-medium ${
              depasseStock ? "text-danger-600" : "text-[var(--encre-faible)]"
            }`}
          >
            {depasseStock ? "Dépasse le stock disponible" : "Montant"}
          </p>
          <p
            className={`chiffres text-2xl font-bold ${
              depasseStock ? "text-danger-600" : ""
            }`}
          >
            {fmt(montant)}{" "}
            <span className="text-sm font-medium text-[var(--encre-faible)]">
              FCFA
            </span>
          </p>
        </div>

        {/* Poids courants : la plupart des ventes tombent sur des valeurs
            rondes, et les proposer évite quatre frappes à chaque client. */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[0.25, 0.5, 1, 2, 5].map((raccourci) => (
            <button
              key={raccourci}
              type="button"
              onClick={() => setSaisie(String(raccourci).replace(".", ","))}
              className="sans-selection chiffres h-cible rounded-lg border border-[var(--filet)] px-3 text-sm hover:bg-[var(--surface-creuse)]"
            >
              {String(raccourci).replace(".", ",")} {info.abrege}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "←"].map(
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

        <button
          type="button"
          disabled={!valide}
          onClick={() => onValider(ajusterAuPas(quantite, unite))}
          className="sans-selection h-touche w-full rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-40"
        >
          {valide ? `Ajouter — ${fmt(montant)} FCFA` : "Saisissez une quantité"}
        </button>
      </div>
    </div>
  );
}
