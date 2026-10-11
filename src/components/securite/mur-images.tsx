"use client";

import { useState } from "react";

import { DISPOSITIONS, dispositionPour, type Disposition } from "@/modules/securite/calcul";

import { LecteurCamera } from "./lecteur-camera";

export interface CameraMur {
  id: string;
  nom: string;
  emplacement: string | null;
  hd: boolean;
}

export interface SiteMur {
  id: string;
  nom: string;
  enLigne: boolean;
  cameras: CameraMur[];
}

const GRILLE: Record<Disposition, string> = {
  1: "grid-cols-1",
  4: "grid-cols-1 sm:grid-cols-2",
  9: "grid-cols-2 lg:grid-cols-3",
  16: "grid-cols-2 lg:grid-cols-4",
};

/**
 * Mur d'images : les caméras d'un site en mosaïque, en flux secondaire.
 * Le plein écran passe au flux principal quand la caméra le publie.
 *
 * Une page de caméras se lit en direct seulement quand elle est affichée :
 * seize flux tenus pour rien saturent la liaison montante du site.
 */
export function MurImages({ sites }: { sites: SiteMur[] }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const site = sites.find((s) => s.id === siteId) ?? sites[0];
  const [disposition, setDisposition] = useState<Disposition>(dispositionPour(site?.cameras.length ?? 1));
  const [page, setPage] = useState(0);
  const [agrandie, setAgrandie] = useState<CameraMur | null>(null);

  if (!site) return null;
  const pages = Math.max(1, Math.ceil(site.cameras.length / disposition));
  const visibles = site.cameras.slice(page * disposition, (page + 1) * disposition);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Sites">
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === site.id}
              onClick={() => {
                setSiteId(s.id);
                setPage(0);
                setDisposition(dispositionPour(s.cameras.length));
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${
                s.id === site.id ? "border-marque-600 bg-marque-600 text-white" : "border-[var(--filet)] hover:bg-[var(--surface-creuse)]"
              }`}
            >
              <span className={`size-2 rounded-full ${s.enLigne ? "bg-valide-500" : "bg-[var(--encre-faible)]"}`} aria-hidden />
              {s.nom}
              <span className="sr-only">{s.enLigne ? "(relais en ligne)" : "(relais hors ligne)"}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-[var(--encre-faible)]">Images</span>
          {DISPOSITIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === disposition}
              onClick={() => {
                setDisposition(d);
                setPage(0);
              }}
              className={`chiffres min-w-8 rounded border px-2 py-0.5 ${d === disposition ? "border-marque-600 bg-marque-600 text-white" : "border-[var(--filet)] hover:bg-[var(--surface-creuse)]"}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {site.cameras.length === 0 ? (
        <p className="text-sm text-[var(--encre-faible)]">Aucune caméra active sur ce site.</p>
      ) : (
        <div className={`grid gap-1.5 ${GRILLE[disposition]}`}>
          {visibles.map((c) => (
            <LecteurCamera key={`${site.id}-${c.id}`} cameraId={c.id} qualite="sd" nom={c.nom} emplacement={c.emplacement} onAgrandir={() => setAgrandie(c)} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-[var(--filet)] px-2.5 py-1 disabled:opacity-40">
            ←
          </button>
          <span className="chiffres">
            {page + 1} / {pages}
          </span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded border border-[var(--filet)] px-2.5 py-1 disabled:opacity-40">
            →
          </button>
        </div>
      )}

      {agrandie && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={agrandie.nom}>
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={() => setAgrandie(null)} className="rounded border border-white/40 px-3 py-1 text-sm text-white hover:bg-white/10">
              Fermer
            </button>
          </div>
          <div className="mx-auto w-full max-w-6xl">
            <LecteurCamera cameraId={agrandie.id} qualite={agrandie.hd ? "hd" : "sd"} nom={agrandie.nom} emplacement={agrandie.emplacement} />
          </div>
        </div>
      )}
    </>
  );
}
