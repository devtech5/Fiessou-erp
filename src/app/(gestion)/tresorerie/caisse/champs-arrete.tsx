"use client";

import { useState } from "react";

import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";

import { libelleChamp, type CompteChoix } from "../champs";

/**
 * Arrêté de caisse : on choisit la caisse, on compte, l'écart s'affiche avant
 * de valider. Le solde attendu est celui des écritures au moment de l'écran ;
 * le serveur le relit au moment de passer l'arrêté.
 */
export function ChampsArrete({ caisses }: { caisses: CompteChoix[] }) {
  const [id, setId] = useState(caisses[0]?.id ?? "");
  const [compte, setCompte] = useState("");
  const caisse = caisses.find((c) => c.id === id);
  const saisi = compte.replace(/[\s  ]/g, "");
  const ecart = caisse && /^\d+$/.test(saisi) ? Number(saisi) - caisse.solde : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={libelleChamp}>Caisse</span>
          <select name="compteId" value={id} onChange={(e) => setId(e.target.value)} className={CLASSE_CHAMP}>
            {caisses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={libelleChamp}>Espèces comptées (F)</span>
          <input name="compte" required inputMode="numeric" value={compte} onChange={(e) => setCompte(e.target.value)} className={`${CLASSE_CHAMP} chiffres`} />
        </label>
      </div>
      {caisse && (
        <p className="text-sm">
          Solde attendu d&apos;après les écritures : <strong className="chiffres">{fmt(caisse.solde)} F</strong>
          {ecart !== null && (
            <>
              {" — "}
              <strong className={ecart === 0 ? "text-valide-600" : ecart < 0 ? "text-danger-600" : "text-alerte-600"}>
                {ecart === 0 ? "caisse juste" : `${ecart < 0 ? "manquant" : "excédent"} de ${fmt(Math.abs(ecart))} F`}
              </strong>
              {ecart !== 0 && <span className="text-[var(--encre-faible)]"> (passé en {ecart < 0 ? "658" : "758"})</span>}
            </>
          )}
        </p>
      )}
      <label className="block">
        <span className={libelleChamp}>Observations</span>
        <input name="observations" maxLength={300} className={CLASSE_CHAMP} />
      </label>
    </div>
  );
}
