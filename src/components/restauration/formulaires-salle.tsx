"use client";

import { FormulaireRepliable, Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP, Champ } from "@/components/ui/primitives";
import { basculerTable, creerPosteSalle, creerTable } from "@/modules/restauration/actions";
import type { Espace } from "@/modules/restauration/calcul";

export function FormulaireTable({ espace, zones }: { espace: Espace; zones: string[] }) {
  return (
    <FormulaireRepliable libelle="Ajouter une table" titre="Nouvelle table" action={(donnees) => creerTable(espace, donnees)}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Champ libelle="Nom" precision="Numéro ou nom : 12, Baobab, VIP 2">
          <input name="nom" required maxLength={40} className={CLASSE_CHAMP} />
        </Champ>
        <Champ libelle="Zone" precision="Salle, terrasse, VIP…">
          <input name="zone" list="zones-salle" maxLength={40} placeholder="Salle" className={CLASSE_CHAMP} />
          <datalist id="zones-salle">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </Champ>
        <Champ libelle="Places">
          <input name="places" inputMode="numeric" placeholder="4" className={`${CLASSE_CHAMP} chiffres`} />
        </Champ>
        <Champ libelle="Ordre sur le plan" precision="Les petits numéros d'abord">
          <input name="ordre" inputMode="numeric" placeholder="0" className={`${CLASSE_CHAMP} chiffres`} />
        </Champ>
      </div>
    </FormulaireRepliable>
  );
}

export function FormulairePosteSalle({ espace, depots }: { espace: Espace; depots: { id: string; nom: string }[] }) {
  return (
    <FormulaireRepliable
      libelle="Ouvrir un poste de salle"
      titre="Poste d'encaissement de la salle"
      action={(donnees) => creerPosteSalle(espace, donnees)}
      desactive={depots.length === 0}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Champ libelle="Code" precision="Préfixe des tickets : SAL donne SAL-000042">
          <input name="code" required maxLength={10} placeholder="SAL" className={`${CLASSE_CHAMP} uppercase`} />
        </Champ>
        <Champ libelle="Nom">
          <input name="nom" required maxLength={60} placeholder="Salle du restaurant" className={CLASSE_CHAMP} />
        </Champ>
        <Champ libelle="Dépôt" precision="D'où sortent les boissons servies">
          <select name="depotId" required className={CLASSE_CHAMP}>
            {depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </Champ>
      </div>
    </FormulaireRepliable>
  );
}

export function BasculerTable({ espace, tableId, actif }: { espace: Espace; tableId: string; actif: boolean }) {
  const { resultat, enCours, lancer } = useOperation();
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={enCours}
        onClick={() => lancer(() => basculerTable(espace, tableId, !actif))}
        className="text-xs font-medium text-marque-600 hover:underline disabled:opacity-50"
      >
        {actif ? "Retirer du plan" : "Remettre sur le plan"}
      </button>
      {resultat && !resultat.ok && <Retour resultat={resultat} />}
    </div>
  );
}
