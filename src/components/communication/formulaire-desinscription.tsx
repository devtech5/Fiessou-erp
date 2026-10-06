"use client";

import { useRef } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP_COMPACT } from "@/components/ui/primitives";
import { desinscrireManuellement } from "@/modules/communication/actions";

/** Désinscription demandée de vive voix : le client l'a dit au téléphone. */
export function FormulaireDesinscription() {
  const formulaire = useRef<HTMLFormElement>(null);
  const op = useOperation();
  return (
    <form
      ref={formulaire}
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        op.lancer(() => desinscrireManuellement(donnees), () => formulaire.current?.reset());
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <select name="canal" aria-label="Canal" className={`${CLASSE_CHAMP_COMPACT} h-10`}>
        <option value="email">E-mail</option>
        <option value="whatsapp">WhatsApp</option>
      </select>
      <input name="adresse" required placeholder="Adresse ou numéro" aria-label="Adresse ou numéro" className={`${CLASSE_CHAMP_COMPACT} h-10 w-56`} />
      <button type="submit" disabled={op.enCours} className="h-10 rounded-lg bg-marque-500 px-4 text-sm font-semibold text-white disabled:opacity-50">
        Désinscrire
      </button>
      <Retour resultat={op.resultat} />
    </form>
  );
}
