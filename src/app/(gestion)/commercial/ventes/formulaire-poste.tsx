"use client";

import { useActionState, useState } from "react";

import { Champ, CLASSE_CHAMP } from "@/components/ui/primitives";
import { creerPosteCaisse, type EtatPoste } from "@/modules/ventes/actions";

/**
 * Ouverture d'un poste d'encaissement.
 *
 * Le code est court et visible : il devient le préfixe des tickets — « C01- »
 * donne « C01-000042 ». Un client qui revient contester trois mois plus tard
 * apporte un reçu qui dit à lui seul de quelle caisse il sort.
 */
export function FormulairePoste({
  depots,
}: {
  depots: { id: string; nom: string }[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<EtatPoste, FormData>(
    creerPosteCaisse,
    {},
  );

  const [dernierCree, setDernierCree] = useState(etat.cree);
  if (etat.cree !== dernierCree) {
    setDernierCree(etat.cree);
    if (etat.cree) setOuvert(false);
  }

  if (!ouvert) {
    return (
      <div className="flex items-center gap-3">
        {etat.cree && (
          <span className="text-sm text-valide-600">Poste {etat.cree} ouvert.</span>
        )}
        <button
          type="button"
          onClick={() => setOuvert(true)}
          disabled={depots.length === 0}
          className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)] disabled:opacity-50"
        >
          Nouveau poste de caisse
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="w-full rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Nouveau poste de caisse</h3>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-sm text-[var(--encre-faible)] hover:underline"
        >
          Annuler
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Champ libelle="Code" precision="Préfixe des tickets : C01 donne C01-000042.">
          <input
            name="code"
            autoFocus
            required
            placeholder="C01"
            maxLength={10}
            className={`${CLASSE_CHAMP} chiffres`}
          />
        </Champ>

        <Champ libelle="Nom">
          <input
            name="nom"
            required
            placeholder="Caisse comptoir"
            className={CLASSE_CHAMP}
          />
        </Champ>

        {/* Le dépôt n'est pas cosmétique : c'est de lui que sort la
            marchandise vendue, et son stock que la vente décrémente. */}
        <Champ libelle="Dépôt servi" precision="Celui d'où sort la marchandise.">
          <select name="depotId" defaultValue={depots[0]?.id} className={CLASSE_CHAMP}>
            {depots.map((depot) => (
              <option key={depot.id} value={depot.id}>
                {depot.nom}
              </option>
            ))}
          </select>
        </Champ>
      </div>

      {etat.erreur && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-600"
        >
          {etat.erreur}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={enCours}
          className="h-cible rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
        >
          {enCours ? "Ouverture…" : "Ouvrir le poste"}
        </button>
      </div>
    </form>
  );
}
