"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Pastille } from "@/components/ui/primitives";
import type { NiveauAcces } from "@/lib/droits/acces";

import { basculerModule, definirAcces, type ResultatAcces } from "./actions";

export interface LigneAcces {
  cle: string;
  nom: string;
  description: string;
  /** Niveau posé pour la personne. */
  niveau: NiveauAcces;
  /** Ce que la personne obtient réellement, rôle compris. */
  effectif: NiveauAcces;
  /** Coupé pour toute l'entreprise : le niveau personnel n'y change rien. */
  coupe: boolean;
}

const LIBELLE: Record<NiveauAcces, string> = {
  aucun: "Aucun",
  consultation: "Consultation",
  complet: "Complet",
};

const TON = { aucun: "neutre", consultation: "alerte", complet: "valide" } as const;

function Retour({ resultat }: { resultat: ResultatAcces | null }) {
  if (!resultat) return null;
  return (
    <p
      role={resultat.ok ? "status" : "alert"}
      className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${
        resultat.ok ? "bg-valide-50 text-valide-600" : "bg-danger-50 text-danger-600"
      }`}
    >
      {resultat.message}
    </p>
  );
}

/**
 * Grille des accès d'un membre, module par module.
 *
 * Trois niveaux, toujours les mêmes, et la colonne « obtient » qui dit la
 * vérité : le niveau resserre le rôle, il ne l'élargit pas. Régler
 * « Complet » la comptabilité d'un caissier ne lui donne que ce que son rôle
 * de caissier permet — et l'écran le montre au lieu de le laisser croire.
 */
export function GrilleAcces({
  membershipId,
  lignes,
  modifiable,
}: {
  membershipId: string;
  lignes: LigneAcces[];
  modifiable: boolean;
}) {
  const [resultat, setResultat] = useState<ResultatAcces | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  function changer(module: string, niveau: NiveauAcces) {
    setResultat(null);
    demarrer(async () => {
      const r = await definirAcces(membershipId, module, niveau);
      setResultat(r);
      if (r.ok) routeur.refresh();
    });
  }

  return (
    <>
      <Retour resultat={resultat} />
      <div className="overflow-x-auto rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--filet)] text-left text-xs text-[var(--encre-faible)]">
              <th className="px-4 py-2.5 font-medium">Module</th>
              <th className="px-4 py-2.5 font-medium">Niveau accordé</th>
              <th className="px-4 py-2.5 font-medium">Obtient réellement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--filet)]">
            {lignes.map((ligne) => (
              <tr key={ligne.cle} className={ligne.coupe ? "opacity-60" : ""}>
                <td className="px-4 py-3">
                  <span className="block font-medium">{ligne.nom}</span>
                  <span className="block max-w-md text-xs text-[var(--encre-faible)]">{ligne.description}</span>
                </td>
                <td className="px-4 py-3">
                  {modifiable && !ligne.coupe ? (
                    <div role="radiogroup" aria-label={`Accès à ${ligne.nom}`} className="inline-flex rounded-lg border border-[var(--filet)] p-0.5">
                      {(["aucun", "consultation", "complet"] as const).map((niveau) => (
                        <button
                          key={niveau}
                          type="button"
                          role="radio"
                          aria-checked={ligne.niveau === niveau}
                          disabled={enCours}
                          onClick={() => ligne.niveau !== niveau && changer(ligne.cle, niveau)}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                            ligne.niveau === niveau
                              ? "bg-marque-600 text-white"
                              : "text-[var(--encre-douce)] hover:bg-[var(--surface-creuse)]"
                          }`}
                        >
                          {LIBELLE[niveau]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--encre-faible)]">
                      {ligne.coupe ? "Module coupé pour l'entreprise" : LIBELLE[ligne.niveau]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Pastille ton={ligne.coupe ? "neutre" : TON[ligne.effectif]}>
                    {ligne.coupe ? "Rien" : LIBELLE[ligne.effectif]}
                  </Pastille>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Interrupteurs des modules de l'entreprise. */
export function BasculesModules({
  modules,
  modifiable,
}: {
  modules: { cle: string; nom: string; description: string; actif: boolean; couche: string }[];
  modifiable: boolean;
}) {
  const [resultat, setResultat] = useState<ResultatAcces | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  return (
    <>
      <Retour resultat={resultat} />
      <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
        {modules.map((m) => (
          <li key={m.cle} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {m.nom}{" "}
                <span className="text-xs font-normal text-[var(--encre-faible)]">· {m.couche}</span>
              </p>
              <p className="max-w-xl text-xs text-[var(--encre-faible)]">{m.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={m.actif}
              aria-label={`${m.actif ? "Couper" : "Activer"} ${m.nom}`}
              disabled={!modifiable || enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await basculerModule(m.cle, !m.actif);
                  setResultat(r);
                  if (r.ok) routeur.refresh();
                })
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                m.actif ? "bg-valide-500" : "bg-[var(--filet)]"
              }`}
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${
                  m.actif ? "left-6" : "left-1"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
