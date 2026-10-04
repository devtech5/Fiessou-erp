"use client";

import { useActionState, useEffect } from "react";

import { Champ, CLASSE_CHAMP } from "@/components/ui/primitives";
import type { Droit } from "@/lib/droits/catalogue";
import { creerRole, modifierDroitsRole, type EtatRole } from "./actions";

export interface GroupeDroits {
  moduleKey: string;
  libelle: string;
  droits: { cle: Droit; libelle: string; description: string | null }[];
}

export interface RoleModifiable {
  id: string;
  nom: string;
  description: string | null;
  droits: Droit[];
}

/**
 * Composition des droits d'un rôle.
 *
 * Les cases sont groupées par module : vingt-trois cases à la file ne se
 * lisent pas, alors qu'une ligne « Stock » se décide d'un coup d'œil.
 *
 * Un droit que le compositeur ne détient pas apparaît coché et désactivé s'il
 * est déjà au rôle, absent sinon. On ne donne pas ce qu'on n'a pas, et on ne
 * retire pas non plus ce qu'on ne voit pas : l'action serveur conserve ces
 * droits-là tels quels.
 */
export function FormulaireRole({
  role,
  groupes,
  detenus,
  onFini,
}: {
  /** Absent : composition d'un rôle neuf. */
  role?: RoleModifiable;
  groupes: GroupeDroits[];
  detenus: Droit[];
  onFini: () => void;
}) {
  const [etat, action, enCours] = useActionState<EtatRole, FormData>(
    role ? modifierDroitsRole : creerRole,
    {},
  );

  const accordes = new Set(detenus);
  const auRole = new Set(role?.droits ?? []);

  // Le formulaire se referme quand le serveur a confirmé. Dans un effet et non
  // pendant le rendu : refermer, c'est changer l'état du parent, et React
  // refuse qu'un composant en modifie un autre pendant qu'il se rend.
  useEffect(() => {
    if (etat.enregistre) onFini();
    // `onFini` est recréé à chaque rendu du parent ; le suivre relancerait
    // l'effet en boucle. Seule la confirmation doit le déclencher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat.enregistre]);

  return (
    <form
      action={action}
      className="mt-3 rounded-xl border border-[var(--filet)] bg-[var(--fond)] p-4"
    >
      {role && <input type="hidden" name="roleId" value={role.id} />}

      {!role && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Champ libelle="Nom du rôle">
            <input
              name="nom"
              autoFocus
              required
              placeholder="Préparateur"
              className={CLASSE_CHAMP}
            />
          </Champ>

          <Champ libelle="À quoi il sert" precision="Facultatif.">
            <input
              name="description"
              placeholder="Voit le stock, ne touche pas aux prix."
              className={CLASSE_CHAMP}
            />
          </Champ>
        </div>
      )}

      <div className="space-y-4">
        {groupes.map((groupe) => {
          // Un module dont le compositeur ne détient aucun droit ne lui sert à
          // rien : il ne pourrait cocher aucune de ses cases.
          const visibles = groupe.droits.filter(
            (droit) => accordes.has(droit.cle) || auRole.has(droit.cle),
          );
          if (visibles.length === 0) return null;

          return (
            <fieldset key={groupe.moduleKey}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--encre-faible)]">
                {groupe.libelle}
              </legend>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibles.map((droit) => {
                  const horsPortee = !accordes.has(droit.cle);

                  return (
                    <label
                      key={droit.cle}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface-creuse)]"
                    >
                      <input
                        type="checkbox"
                        name="droits"
                        value={droit.cle}
                        defaultChecked={auRole.has(droit.cle)}
                        disabled={horsPortee}
                        className="mt-0.5 size-4 shrink-0 accent-marque-600"
                      />
                      <span className={horsPortee ? "opacity-60" : undefined}>
                        <span className="block font-medium">{droit.libelle}</span>
                        {droit.description && (
                          <span className="block text-xs text-[var(--encre-faible)]">
                            {droit.description}
                          </span>
                        )}
                        {horsPortee && (
                          <span className="block text-xs text-[var(--encre-faible)]">
                            Vous ne détenez pas ce droit : il reste au rôle, vous
                            ne pouvez ni le donner ni le retirer.
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {etat.erreur && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-600"
        >
          {etat.erreur}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onFini}
          className="h-cible rounded-lg border border-[var(--filet)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={enCours}
          className="h-cible rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : role ? "Enregistrer" : "Créer le rôle"}
        </button>
      </div>
    </form>
  );
}
