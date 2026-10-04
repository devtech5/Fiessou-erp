"use client";

import { useState } from "react";

import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { compteSuggere, LIBELLE_NATURE_COMPTE, type NatureCompte } from "@/modules/tresorerie/calcul";

export interface Membre {
  userId: string;
  nom: string;
}

export interface CompteChoix {
  id: string;
  nom: string;
  nature: NatureCompte;
  solde: number;
}

export const libelleChamp = "mb-1 block text-xs font-semibold text-[var(--encre-faible)]";

const OPERATEURS = ["Wave", "Orange Money", "MTN MoMo", "Moov Money"];

/**
 * Champs d'un compte de trésorerie. À la création, le numéro SYSCOHADA est
 * proposé selon la nature et les comptes déjà pris ; il reste modifiable.
 */
export function ChampsCompte({
  membres,
  comptesPris,
  initial,
}: {
  membres: Membre[];
  /** Numéros déjà utilisés. Absent : modification, le numéro ne change plus. */
  comptesPris?: string[];
  initial?: { nom: string; etablissement: string | null; reference: string | null; responsableUserId: string | null; seuilAlerte: number; actif: boolean };
}) {
  const creation = comptesPris !== undefined;
  const [nature, setNature] = useState<NatureCompte>("caisse");
  const [compte, setCompte] = useState(() => (creation ? (compteSuggere("caisse", comptesPris) ?? "") : ""));

  return (
    <div className="space-y-3">
      {creation && (
        <fieldset>
          <legend className={libelleChamp}>Nature</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LIBELLE_NATURE_COMPTE) as NatureCompte[]).map((n) => (
              <label
                key={n}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  nature === n ? "border-marque-500 bg-[var(--surface-creuse)] font-semibold" : "border-[var(--filet)]"
                }`}
              >
                <input
                  type="radio"
                  name="nature"
                  value={n}
                  checked={nature === n}
                  onChange={() => {
                    setNature(n);
                    setCompte(compteSuggere(n, comptesPris) ?? "");
                  }}
                  className="accent-marque-600"
                />
                {LIBELLE_NATURE_COMPTE[n]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={libelleChamp}>Nom</span>
          <input
            name="nom"
            required
            minLength={2}
            maxLength={80}
            defaultValue={initial?.nom}
            placeholder={nature === "banque" ? "SGBCI — compte courant" : nature === "mobile_money" ? "Wave de l'entreprise" : "Caisse siège"}
            className={CLASSE_CHAMP}
          />
        </label>
        {creation && (
          <label className="block">
            <span className={libelleChamp}>Compte SYSCOHADA</span>
            <input name="compte" required value={compte} onChange={(e) => setCompte(e.target.value.trim())} className={`${CLASSE_CHAMP} chiffres`} />
          </label>
        )}
        <label className="block">
          <span className={libelleChamp}>{nature === "banque" ? "Banque" : nature === "mobile_money" ? "Opérateur" : "Lieu"}</span>
          <input name="etablissement" maxLength={80} defaultValue={initial?.etablissement ?? ""} list="operateurs-tresorerie" className={CLASSE_CHAMP} />
          <datalist id="operateurs-tresorerie">
            {OPERATEURS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className={libelleChamp}>{nature === "banque" ? "RIB" : nature === "mobile_money" ? "Numéro du portefeuille" : "Référence"}</span>
          <input name="reference" maxLength={80} defaultValue={initial?.reference ?? ""} className={`${CLASSE_CHAMP} chiffres`} />
        </label>
        <label className="block">
          <span className={libelleChamp}>Responsable</span>
          <select name="responsableUserId" defaultValue={initial?.responsableUserId ?? ""} className={CLASSE_CHAMP}>
            <option value="">Personne en particulier</option>
            {membres.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={libelleChamp}>Seuil d&apos;alerte (F)</span>
          <input name="seuilAlerte" inputMode="numeric" defaultValue={initial ? String(initial.seuilAlerte) : "0"} className={`${CLASSE_CHAMP} chiffres`} />
        </label>
      </div>
      {!creation && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="actif" defaultChecked={initial?.actif ?? true} className="accent-marque-600" />
          Compte en service — décoché, il ne reçoit plus rien et sort des listes.
        </label>
      )}
    </div>
  );
}

/** Liste de comptes groupée par nature, pour choisir une source ou une destination. */
export function OptionsComptes({
  comptes,
  sansBanque = false,
  masquerSolde = false,
}: {
  comptes: CompteChoix[];
  sansBanque?: boolean;
  /** Qui demande un bon sans consulter la trésorerie ne lit pas les soldes. */
  masquerSolde?: boolean;
}) {
  const natures = (Object.keys(LIBELLE_NATURE_COMPTE) as NatureCompte[]).filter((n) => !(sansBanque && n === "banque"));
  return (
    <>
      {natures.map((n) => {
        const liste = comptes.filter((c) => c.nature === n);
        if (liste.length === 0) return null;
        return (
          <optgroup key={n} label={LIBELLE_NATURE_COMPTE[n]}>
            {liste.map((c) => (
              <option key={c.id} value={c.id}>
                {masquerSolde ? c.nom : `${c.nom} — ${c.solde.toLocaleString("fr-FR")} F`}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
