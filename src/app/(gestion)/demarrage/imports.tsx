"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CLASSE_CHAMP_COMPACT } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { lireArticles, lireStock, lireTiers, MODELES, type Anomalie } from "@/modules/reprise/calcul";
import { importerArticles, importerStock, importerTiers, reprendreTresorerie, type ResultatImport } from "@/modules/reprise/actions";

type Nature = "articles" | "tiers" | "stock";

const NOMS: Record<Nature, string> = { articles: "modele-articles.csv", tiers: "modele-clients-fournisseurs.csv", stock: "modele-stock-initial.csv" };

/** Aperçu calculé dans le navigateur, avec les mêmes règles que le serveur. */
function apercu(nature: Nature, texte: string): { lignes: number; anomalies: Anomalie[]; resume: string } {
  if (nature === "articles") {
    const r = lireArticles(texte);
    return { lignes: r.articles.length, anomalies: r.anomalies, resume: `${r.articles.length} article(s)` };
  }
  if (nature === "tiers") {
    const r = lireTiers(texte);
    const creances = r.tiers.filter((t) => t.estClient && t.solde > 0).reduce((s, t) => s + t.solde, 0);
    const dettes = r.tiers.filter((t) => t.estFournisseur && t.solde > 0).reduce((s, t) => s + t.solde, 0);
    return { lignes: r.tiers.length, anomalies: r.anomalies, resume: `${r.tiers.length} fiche(s) · créances ${fmt(creances)} F · dettes ${fmt(dettes)} F` };
  }
  const r = lireStock(texte);
  return { lignes: r.stock.length, anomalies: r.anomalies, resume: `${r.stock.length} ligne(s) de stock` };
}

export function ImportFichier({ nature, titre, aide, date }: { nature: Nature; titre: string; aide: string; date?: string }) {
  const [texte, setTexte] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();
  const vu = texte ? apercu(nature, texte) : null;
  const anomalies = resultat && !resultat.ok ? (resultat.anomalies ?? []) : (vu?.anomalies ?? []);

  const modele = `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + MODELES[nature])}`;

  return (
    <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{titre}</h2>
        <a href={modele} download={NOMS[nature]} className="text-xs font-semibold text-marque-600 hover:underline">
          Télécharger le modèle
        </a>
      </header>
      <p className="mb-3 text-sm text-[var(--encre-douce)]">{aide}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[var(--filet)] px-3 text-sm font-medium hover:bg-[var(--surface-creuse)]">
          {nom || "Choisir un fichier CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setResultat(null);
              if (!f) return;
              setNom(f.name);
              setTexte(await f.text());
            }}
          />
        </label>
        {vu && <span className="text-sm text-[var(--encre-douce)]">{vu.resume}</span>}
        {vu && vu.anomalies.length === 0 && vu.lignes > 0 && (
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r =
                  nature === "articles" ? await importerArticles(texte!) : nature === "tiers" ? await importerTiers(texte!, date!) : await importerStock(texte!, date!);
                setResultat(r);
                if (r.ok) {
                  setTexte(null);
                  setNom("");
                  routeur.refresh();
                }
              })
            }
            className="h-9 rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {enCours ? "Import…" : "Importer"}
          </button>
        )}
      </div>
      {resultat && (
        <p role={resultat.ok ? "status" : "alert"} className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${resultat.ok ? "bg-valide-50 text-valide-600" : "bg-danger-50 text-danger-600"}`}>
          {resultat.message}
        </p>
      )}
      {anomalies.length > 0 && (
        <ul className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-danger-500/40 bg-danger-50 p-3 text-xs text-danger-600">
          {anomalies.map((a) => (
            <li key={`${a.ligne}-${a.message}`}>
              Ligne {a.ligne} : {a.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SoldesTresorerie({ comptes, date }: { comptes: { id: string; nom: string; nature: string; repris: boolean }[]; date: string }) {
  const [soldes, setSoldes] = useState<Record<string, string>>({});
  const [resultats, setResultats] = useState<Record<string, ResultatImport>>({});
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  if (comptes.length === 0) return <p className="text-sm text-[var(--encre-faible)]">Déclarez d&apos;abord vos comptes dans Trésorerie → Comptes.</p>;

  return (
    <ul className="divide-y divide-[var(--filet)]">
      {comptes.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className="min-w-40 flex-1 text-sm font-medium">{c.nom}</span>
          {c.repris ? (
            <span className="text-xs text-valide-600">Solde d&apos;ouverture repris</span>
          ) : (
            <>
              <input
                inputMode="numeric"
                placeholder={c.nature === "banque" ? "Solde (négatif si découvert)" : "Solde en caisse"}
                value={soldes[c.id] ?? ""}
                onChange={(e) => setSoldes({ ...soldes, [c.id]: e.target.value })}
                className={`${CLASSE_CHAMP_COMPACT} h-9 w-48`}
              />
              <button
                type="button"
                disabled={enCours || !soldes[c.id]}
                onClick={() =>
                  demarrer(async () => {
                    const r = await reprendreTresorerie(c.id, Number((soldes[c.id] ?? "").replace(/[\s ]/g, "")), date);
                    setResultats({ ...resultats, [c.id]: r });
                    if (r.ok) routeur.refresh();
                  })
                }
                className="h-9 rounded-lg border border-[var(--filet)] px-3 text-sm font-semibold hover:bg-[var(--surface-creuse)] disabled:opacity-50"
              >
                Reprendre
              </button>
            </>
          )}
          {resultats[c.id] && <span className={`w-full text-xs ${resultats[c.id].ok ? "text-valide-600" : "text-danger-600"}`}>{resultats[c.id].message}</span>}
        </li>
      ))}
    </ul>
  );
}
