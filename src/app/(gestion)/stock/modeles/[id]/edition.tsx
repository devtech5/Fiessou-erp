"use client";

import { useState } from "react";

import { Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP_COMPACT } from "@/components/ui/primitives";
import { ajouterValeurs, modifierPrixVariantes } from "@/modules/catalogue/actions-modeles";

interface Variante {
  id: string;
  reference: string;
  libelle: string;
  prixVente: number;
  stock: string;
  actif: boolean;
}

/** Prix par variante : seuls les prix changés partent au serveur. */
export function PrixVariantes({ modeleId, variantes, modifiable }: { modeleId: string; variantes: Variante[]; modifiable: boolean }) {
  const op = useOperation();
  const [prix, setPrix] = useState<Record<string, string>>({});
  const changes = variantes.filter((v) => prix[v.id] !== undefined && prix[v.id] !== "" && Number(prix[v.id]) !== v.prixVente);

  return (
    <section className="mb-6 rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-[var(--filet)] text-xs text-[var(--encre-faible)]">
              <th className="px-3 py-2 text-left font-semibold">Référence</th>
              <th className="px-3 py-2 text-left font-semibold">Variante</th>
              <th className="px-3 py-2 text-right font-semibold">Stock</th>
              <th className="px-3 py-2 text-right font-semibold">Prix de vente</th>
            </tr>
          </thead>
          <tbody>
            {variantes.map((v) => (
              <tr key={v.id} className={`border-b border-[var(--filet)] last:border-0 ${v.actif ? "" : "opacity-50"}`}>
                <td className="px-3 py-1.5 font-mono text-xs">{v.reference}</td>
                <td className="px-3 py-1.5">{v.libelle}</td>
                <td className="px-3 py-1.5 text-right">{v.stock}</td>
                <td className="px-3 py-1.5 text-right">
                  {modifiable ? (
                    <input
                      inputMode="numeric"
                      value={prix[v.id] ?? String(v.prixVente)}
                      onChange={(e) => setPrix({ ...prix, [v.id]: e.target.value.replace(/\D/g, "") })}
                      aria-label={`Prix de ${v.reference}`}
                      className={`${CLASSE_CHAMP_COMPACT} h-8 w-28 text-right`}
                    />
                  ) : (
                    v.prixVente.toLocaleString("fr-FR")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modifiable && (
        <div className="flex items-center justify-end gap-3 border-t border-[var(--filet)] p-3">
          {op.resultat && <Retour resultat={op.resultat} />}
          <button
            type="button"
            disabled={op.enCours || changes.length === 0}
            onClick={() => op.lancer(() => modifierPrixVariantes(modeleId, changes.map((v) => ({ articleId: v.id, prixVente: Number(prix[v.id]) }))), () => setPrix({}))}
            className="h-9 rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {op.enCours ? "Enregistrement…" : changes.length ? `Enregistrer ${changes.length} prix` : "Aucun prix modifié"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Nouvelles valeurs sur les axes existants : une pointure, une couleur de plus. */
export function AjoutValeurs({ modeleId, axes }: { modeleId: string; axes: { nom: string; valeurs: string[] }[] }) {
  const op = useOperation();
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  return (
    <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
      <h2 className="mb-2 font-semibold">Ajouter des déclinaisons</h2>
      <div className="space-y-2">
        {axes.map((a) => (
          <label key={a.nom} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-28 font-medium">{a.nom}</span>
            <span className="text-xs text-[var(--encre-faible)]">{a.valeurs.join(", ")} +</span>
            <input
              value={saisies[a.nom] ?? ""}
              onChange={(e) => setSaisies({ ...saisies, [a.nom]: e.target.value })}
              placeholder="nouvelles valeurs, séparées par des virgules"
              className={`${CLASSE_CHAMP_COMPACT} h-9 min-w-56 flex-1`}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {op.resultat && <Retour resultat={op.resultat} />}
        <button
          type="button"
          disabled={op.enCours || !Object.values(saisies).some((v) => v.trim())}
          onClick={() =>
            op.lancer(
              () => ajouterValeurs(modeleId, axes.map((a) => ({ nom: a.nom, valeurs: (saisies[a.nom] ?? "").split(/[,;]/).map((v) => v.trim()).filter(Boolean) }))),
              () => setSaisies({}),
            )
          }
          className="h-9 rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {op.enCours ? "Création…" : "Créer les variantes manquantes"}
        </button>
      </div>
    </section>
  );
}
