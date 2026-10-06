"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP_COMPACT, Champ } from "@/components/ui/primitives";
import { modifierDelaiVerrouillage } from "@/lib/identite-actions";
import { DELAIS_VERROUILLAGE } from "@/lib/auth/verrou";

/** Délai d'inactivité avant que l'écran se verrouille, pour toute l'entreprise. */
export function FormulaireSecurite({ delai }: { delai: number }) {
  const op = useOperation();
  const [valeur, setValeur] = useState(delai);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        op.lancer(() => modifierDelaiVerrouillage(valeur));
      }}
      className="mt-6 space-y-4 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
    >
      <div>
        <h2 className="text-base font-semibold">Sécurité</h2>
        <p className="mt-1 text-sm text-[var(--encre-douce)]">
          Sans souris, clavier ni toucher pendant ce délai, l&apos;écran se verrouille et ne
          s&apos;ouvre qu&apos;avec le mot de passe. Le travail en cours est conservé. La caisse
          n&apos;est pas concernée : elle reste ouverte entre deux clients.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Champ libelle="Verrouiller l'écran après">
          <select
            value={valeur}
            onChange={(e) => setValeur(Number(e.target.value))}
            className={`${CLASSE_CHAMP_COMPACT} h-10 w-48`}
          >
            {DELAIS_VERROUILLAGE.map((d) => (
              <option key={d} value={d}>
                {d === 60 ? "1 heure" : `${d} minutes`} d&apos;inactivité
              </option>
            ))}
          </select>
        </Champ>
        <button
          type="submit"
          disabled={op.enCours || valeur === delai}
          className="h-10 rounded-lg bg-marque-500 px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {op.enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      {op.resultat && <Retour resultat={op.resultat} />}
    </form>
  );
}
