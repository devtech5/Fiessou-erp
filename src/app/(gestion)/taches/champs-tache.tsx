import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { LIBELLE_PRIORITE, type Priorite } from "@/modules/taches/calcul";

export interface Membre {
  userId: string;
  nom: string;
}

/**
 * Champs d'une tâche, pour la créer comme pour la modifier.
 *
 * Sans le droit d'attribuer, pas de choix d'exécutant : la tâche est pour soi.
 */
export function ChampsTache({
  membres,
  moi,
  attribue,
  initial,
}: {
  membres: Membre[];
  moi: string;
  attribue: boolean;
  initial?: { titre: string; description: string | null; priorite: Priorite; echeance: string | null; assigneeUserId: string };
}) {
  const libelle = "mb-1 block text-xs font-semibold text-[var(--encre-faible)]";
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={libelle}>Ce qu&apos;il faut faire</span>
        <input
          name="titre"
          required
          minLength={3}
          maxLength={160}
          defaultValue={initial?.titre}
          placeholder="Relancer le client Kouassi, inventaire du rayon peinture…"
          className={CLASSE_CHAMP}
        />
      </label>
      <label className="block">
        <span className={libelle}>Précisions</span>
        <textarea
          name="description"
          maxLength={2000}
          rows={2}
          defaultValue={initial?.description ?? ""}
          className={`${CLASSE_CHAMP} h-auto py-2`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={libelle}>Priorité</span>
          <select name="priorite" defaultValue={initial?.priorite ?? "normale"} className={CLASSE_CHAMP}>
            {(Object.keys(LIBELLE_PRIORITE) as Priorite[]).map((p) => (
              <option key={p} value={p}>
                {LIBELLE_PRIORITE[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={libelle}>Échéance</span>
          <input type="date" name="echeance" defaultValue={initial?.echeance ?? ""} className={CLASSE_CHAMP} />
        </label>
        {attribue ? (
          <label className="block">
            <span className={libelle}>Exécutée par</span>
            <select name="assigneeUserId" defaultValue={initial?.assigneeUserId ?? moi} className={CLASSE_CHAMP}>
              {membres.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === moi ? `${m.nom} (moi)` : m.nom}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="assigneeUserId" value={initial?.assigneeUserId ?? moi} />
        )}
      </div>
    </div>
  );
}
