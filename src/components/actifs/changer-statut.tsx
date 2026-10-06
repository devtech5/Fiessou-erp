"use client";

import { useRef } from "react";

import { STATUT_ACTIF } from "@/components/actifs/statut";
import { CLASSE_CHAMP_COMPACT } from "@/components/ui/primitives";
import { changerStatutActif } from "@/modules/actifs/actions";
import type { StatutActif } from "@/modules/actifs/schema";

/** L'état de service se change d'un geste : un véhicule part au garage, un ordinateur revient. */
export function ChangerStatut({ id, statut }: { id: string; statut: StatutActif }) {
  const formulaire = useRef<HTMLFormElement>(null);
  return (
    <form ref={formulaire} action={changerStatutActif}>
      <input type="hidden" name="id" value={id} />
      <select
        name="statut"
        defaultValue={statut}
        aria-label="État de service"
        onChange={() => formulaire.current?.requestSubmit()}
        className={`${CLASSE_CHAMP_COMPACT} h-9`}
      >
        {Object.entries(STATUT_ACTIF).map(([cle, s]) => (
          <option key={cle} value={cle}>
            {s.libelle}
          </option>
        ))}
      </select>
    </form>
  );
}
