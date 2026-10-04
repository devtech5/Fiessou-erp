"use client";

import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { COMPTES_ACHAT, montantHt, totaux, type LigneAchat } from "@/modules/achats/calcul";

export interface ArticleAchat {
  id: string;
  reference: string;
  designation: string;
  unite: string;
  prixAchat: number;
  fournisseurId: string | null;
  tauxTva: number;
  compteAchat: string;
}

/** Ligne en cours de saisie : les nombres restent du texte tant qu'on tape. */
export interface LigneEditee {
  cle: string;
  articleId: string | null;
  ligneCommandeId?: string | null;
  designation: string;
  quantite: string;
  prix: string;
  tva: string;
  compteAchat: string;
}

const nombre = (v: string) => {
  const propre = v.replace(/[\s  ]/g, "").replace(",", ".");
  const n = Number(propre);
  return propre !== "" && Number.isFinite(n) ? n : null;
};

let compteur = 0;
export const nouvelleCle = () => `l${Date.now()}${compteur++}`;

export function ligneVide(): LigneEditee {
  return { cle: nouvelleCle(), articleId: null, designation: "", quantite: "1", prix: "", tva: "18", compteAchat: "601" };
}

/** Conversion vers le format du serveur : quantités en millièmes, TVA en points de base, francs entiers. */
export function versLignesAchat(lignes: LigneEditee[]): (LigneAchat & { articleId: string | null; ligneCommandeId: string | null })[] | string {
  const sortie = [];
  for (const [i, l] of lignes.entries()) {
    if (!l.designation.trim()) return `Ligne ${i + 1} : désignation manquante.`;
    const q = nombre(l.quantite);
    const p = nombre(l.prix);
    const t = nombre(l.tva);
    if (q === null || q <= 0) return `Ligne ${i + 1} : quantité invalide.`;
    if (p === null || p < 0 || !Number.isInteger(p)) return `Ligne ${i + 1} : prix en francs entiers.`;
    if (t === null || t < 0 || t > 100) return `Ligne ${i + 1} : taux de TVA invalide.`;
    sortie.push({
      articleId: l.articleId,
      ligneCommandeId: l.ligneCommandeId ?? null,
      designation: l.designation.trim(),
      quantite: Math.round(q * 1000),
      prixUnitaireHt: p,
      tauxTva: Math.round(t * 100),
      compteAchat: l.compteAchat,
    });
  }
  return sortie;
}

/**
 * Éditeur de lignes d'achat : article du catalogue ou ligne libre, quantité,
 * prix HT, TVA, compte. Les totaux se calculent comme l'écriture le fera.
 */
export function EditeurLignes({
  lignes,
  onChange,
  articles,
  fournisseurId,
  libres = true,
}: {
  lignes: LigneEditee[];
  onChange: (lignes: LigneEditee[]) => void;
  articles: ArticleAchat[];
  fournisseurId: string | null;
  /** Lignes hors catalogue autorisées (frais, prestations). */
  libres?: boolean;
}) {
  const maj = (cle: string, patch: Partial<LigneEditee>) => onChange(lignes.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));
  // Les articles du fournisseur d'abord : c'est chez lui qu'on les commande d'habitude.
  const tries = [...articles].sort((a, b) => Number(b.fournisseurId === fournisseurId) - Number(a.fournisseurId === fournisseurId));

  const converties = versLignesAchat(lignes.filter((l) => l.designation.trim()));
  const t = typeof converties === "string" ? null : totaux(converties);

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,1.2fr)_auto] gap-2 text-xs font-semibold text-[var(--encre-faible)] md:grid">
        <span>Article ou désignation</span>
        <span>Quantité</span>
        <span>Prix HT (F)</span>
        <span>TVA %</span>
        <span>Compte</span>
        <span className="w-8" />
      </div>
      {lignes.map((l, i) => {
        const converti = versLignesAchat([l]);
        const montant = typeof converti === "string" ? null : montantHt(converti[0]);
        return (
          <div key={l.cle} className="grid gap-2 rounded-lg border border-[var(--filet)] p-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,1.2fr)_auto] md:border-0 md:p-0">
            <div className="min-w-0 space-y-1">
              <select
                aria-label={`Article, ligne ${i + 1}`}
                value={l.articleId ?? ""}
                onChange={(e) => {
                  const a = articles.find((x) => x.id === e.target.value);
                  maj(
                    l.cle,
                    a
                      ? { articleId: a.id, designation: a.designation, prix: String(a.prixAchat), tva: String(a.tauxTva / 100), compteAchat: a.compteAchat }
                      : { articleId: null },
                  );
                }}
                className={`${CLASSE_CHAMP} h-9 text-sm`}
              >
                {libres && <option value="">Ligne libre (frais, prestation…)</option>}
                {!libres && !l.articleId && <option value="">Choisir un article…</option>}
                {tries.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fournisseurId === fournisseurId ? "★ " : ""}
                    {a.reference} — {a.designation}
                  </option>
                ))}
              </select>
              {!l.articleId && (
                <input
                  aria-label={`Désignation, ligne ${i + 1}`}
                  value={l.designation}
                  onChange={(e) => maj(l.cle, { designation: e.target.value })}
                  placeholder="Désignation"
                  className={`${CLASSE_CHAMP} h-9 text-sm`}
                />
              )}
            </div>
            <input aria-label={`Quantité, ligne ${i + 1}`} inputMode="decimal" value={l.quantite} onChange={(e) => maj(l.cle, { quantite: e.target.value })} className={`${CLASSE_CHAMP} chiffres h-9 text-right text-sm`} />
            <input aria-label={`Prix HT, ligne ${i + 1}`} inputMode="numeric" value={l.prix} onChange={(e) => maj(l.cle, { prix: e.target.value })} className={`${CLASSE_CHAMP} chiffres h-9 text-right text-sm`} />
            <input aria-label={`TVA, ligne ${i + 1}`} inputMode="decimal" value={l.tva} onChange={(e) => maj(l.cle, { tva: e.target.value })} className={`${CLASSE_CHAMP} chiffres h-9 text-right text-sm`} />
            <select aria-label={`Compte, ligne ${i + 1}`} value={l.compteAchat} onChange={(e) => maj(l.cle, { compteAchat: e.target.value })} className={`${CLASSE_CHAMP} h-9 text-sm`}>
              {!(l.compteAchat in COMPTES_ACHAT) && <option value={l.compteAchat}>{l.compteAchat}</option>}
              {Object.entries(COMPTES_ACHAT).map(([c, lib]) => (
                <option key={c} value={c}>
                  {c} — {lib}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between gap-2 md:justify-end">
              <span className="chiffres text-xs text-[var(--encre-faible)] md:hidden">{montant === null ? "—" : `${fmt(montant)} F HT`}</span>
              <button
                type="button"
                onClick={() => onChange(lignes.filter((x) => x.cle !== l.cle))}
                aria-label={`Retirer la ligne ${i + 1}`}
                disabled={lignes.length === 1}
                className="flex size-8 items-center justify-center rounded-lg text-lg text-[var(--encre-faible)] hover:bg-danger-50 hover:text-danger-600 disabled:opacity-30"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button type="button" onClick={() => onChange([...lignes, ligneVide()])} className="rounded-lg border border-dashed border-[var(--filet)] px-3 py-2 text-sm font-medium hover:border-marque-400 hover:text-marque-600">
          + Ajouter une ligne
        </button>
        <p className="chiffres text-sm">
          {t ? (
            <>
              HT <strong>{fmt(t.totalHt)}</strong> · TVA <strong>{fmt(t.totalTva)}</strong> · TTC <strong className="text-base">{fmt(t.totalTtc)} F</strong>
            </>
          ) : (
            <span className="text-[var(--encre-faible)]">{typeof converties === "string" ? converties : "—"}</span>
          )}
        </p>
      </div>
    </div>
  );
}
