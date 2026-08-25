"use client";

import { useMemo, useState } from "react";

import { Pastille, type TonPastille } from "@/components/ui/primitives";
import { fmtEntier } from "@/lib/format";
import {
  DOCUMENTS,
  LIBELLE_ENTITE,
  LIBELLE_VISIBILITE,
  type TypeEntite,
  type Visibilite,
} from "@/lib/fixtures/documents";

const TON_VISIBILITE: Record<Visibilite, TonPastille> = {
  prive: "danger",
  restreint: "alerte",
  equipe: "neutre",
};

/**
 * Bibliothèque.
 *
 * Le filtre porte sur le rattachement, pas sur des dossiers. Un arbre de
 * dossiers oblige à décider où ranger un contrat qui concerne à la fois un
 * client et un actif ; le rattachement à l'entité répond à la seule question
 * qu'on se pose réellement devant l'écran : « quels papiers ai-je sur ce
 * client, ce véhicule, cet employé ? »
 */
export function Bibliotheque() {
  const [recherche, setRecherche] = useState("");
  const [entite, setEntite] = useState<TypeEntite | null>(null);

  const resultats = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return DOCUMENTS.filter((doc) => {
      if (entite && doc.entite !== entite) return false;
      if (!terme) return true;
      return (
        doc.nom.toLowerCase().includes(terme) ||
        doc.entiteLibelle.toLowerCase().includes(terme) ||
        doc.categorie.toLowerCase().includes(terme)
      );
    });
  }, [recherche, entite]);

  // Seules les entités effectivement représentées sont proposées au filtre.
  const entitesPresentes = useMemo(() => {
    const compte = new Map<TypeEntite, number>();
    for (const doc of DOCUMENTS) {
      compte.set(doc.entite, (compte.get(doc.entite) ?? 0) + 1);
    }
    return [...compte.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  return (
    <>
      <div className="mb-4 space-y-2">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Nom du document, client, véhicule, employé…"
          className="h-cible w-full rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm outline-none focus:border-marque-500"
        />

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setEntite(null)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
              entite === null
                ? "bg-marque-600 text-white"
                : "bg-[var(--surface-creuse)] text-[var(--encre-douce)]"
            }`}
          >
            Tout ({DOCUMENTS.length})
          </button>

          {entitesPresentes.map(([type, nombre]) => (
            <button
              key={type}
              type="button"
              onClick={() => setEntite(type)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
                entite === type
                  ? "bg-marque-600 text-white"
                  : "bg-[var(--surface-creuse)] text-[var(--encre-douce)]"
              }`}
            >
              {LIBELLE_ENTITE[type]} ({nombre})
            </button>
          ))}
        </div>
      </div>

      {resultats.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--encre-faible)]">
          Aucun document ne correspond.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
          {resultats.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <span className="chiffres flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-creuse)] text-[10px] font-bold text-[var(--encre-faible)]">
                {doc.format}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.nom}</p>
                <p className="truncate text-xs text-[var(--encre-faible)]">
                  {/* Le rattachement d'abord : c'est l'information qui sert. */}
                  {LIBELLE_ENTITE[doc.entite]} · {doc.entiteLibelle} ·{" "}
                  {doc.categorie}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {doc.joursAvantExpiration !== undefined && (
                  <Pastille
                    ton={
                      doc.joursAvantExpiration < 0
                        ? "danger"
                        : doc.joursAvantExpiration <= 30
                          ? "alerte"
                          : "neutre"
                    }
                  >
                    {doc.joursAvantExpiration < 0
                      ? "Expiré"
                      : `Expire dans ${doc.joursAvantExpiration} j`}
                  </Pastille>
                )}

                <Pastille ton={TON_VISIBILITE[doc.visibilite]}>
                  {LIBELLE_VISIBILITE[doc.visibilite]}
                </Pastille>

                <span className="chiffres w-20 text-right text-xs text-[var(--encre-faible)]">
                  {fmtEntier(doc.tailleKo)} Ko
                </span>

                <span className="chiffres w-24 text-right text-xs text-[var(--encre-faible)]">
                  {doc.date}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
