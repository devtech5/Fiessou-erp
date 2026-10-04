"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Retour, type Resultat } from "@/components/ui/operations";
import { CLASSE_CHAMP } from "@/components/ui/primitives";
import { enregistrerCommande } from "@/modules/achats/actions";

import { EditeurLignes, ligneVide, nouvelleCle, versLignesAchat, type ArticleAchat, type LigneEditee } from "./lignes";

const libelle = "mb-1 block text-xs font-semibold text-[var(--encre-faible)]";

export interface CommandeInitiale {
  id: string;
  fournisseurId: string;
  depotId: string | null;
  dateCommande: string;
  livraisonPrevue: string | null;
  notes: string | null;
  lignes: { articleId: string | null; designation: string; quantite: number; prixUnitaireHt: number; tauxTva: number; compteAchat: string }[];
}

/** Préparer ou modifier un bon de commande fournisseur. */
export function EditeurCommande({
  fournisseurs,
  depots,
  articles,
  initiale,
  aujourdhui,
}: {
  fournisseurs: { id: string; nom: string; delaiLivraisonJours: number }[];
  depots: { id: string; nom: string; parDefaut: boolean }[];
  articles: ArticleAchat[];
  initiale?: CommandeInitiale;
  aujourdhui: string;
}) {
  const [ouvert, setOuvert] = useState(Boolean(initiale));
  const [fournisseurId, setFournisseurId] = useState(initiale?.fournisseurId ?? "");
  const [depotId, setDepotId] = useState(initiale?.depotId ?? depots.find((d) => d.parDefaut)?.id ?? depots[0]?.id ?? "");
  const [date, setDate] = useState(initiale?.dateCommande ?? aujourdhui);
  const [livraison, setLivraison] = useState(initiale?.livraisonPrevue ?? "");
  const [notes, setNotes] = useState(initiale?.notes ?? "");
  const [lignes, setLignes] = useState<LigneEditee[]>(
    initiale
      ? initiale.lignes.map((l) => ({
          cle: nouvelleCle(),
          articleId: l.articleId,
          designation: l.designation,
          quantite: String(l.quantite / 1000),
          prix: String(l.prixUnitaireHt),
          tva: String(l.tauxTva / 100),
          compteAchat: l.compteAchat,
        }))
      : [ligneVide()],
  );
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white hover:bg-marque-700">
        Nouvelle commande
      </button>
    );
  }

  function choisirFournisseur(id: string) {
    setFournisseurId(id);
    // La livraison attendue se déduit du délai habituel du fournisseur.
    const f = fournisseurs.find((x) => x.id === id);
    if (f && f.delaiLivraisonJours > 0 && !livraison) {
      setLivraison(new Date(Date.parse(`${date}T00:00:00Z`) + f.delaiLivraisonJours * 86_400_000).toISOString().slice(0, 10));
    }
  }

  function enregistrer() {
    setResultat(null);
    const converties = versLignesAchat(lignes.filter((l) => l.designation.trim()));
    if (typeof converties === "string") return setResultat({ ok: false, message: converties });
    demarrer(async () => {
      const r = await enregistrerCommande(
        { fournisseurId, depotId: depotId || null, dateCommande: date, livraisonPrevue: livraison || null, notes: notes || null, lignes: converties },
        initiale?.id ?? null,
      );
      setResultat(r);
      if (r.ok) {
        if (!initiale && r.id) routeur.push(`/achats/commandes/${r.id}`);
        else routeur.refresh();
      }
    });
  }

  return (
    <section className="mb-5 w-full rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 text-left">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{initiale ? "Modifier le brouillon" : "Nouvelle commande fournisseur"}</h2>
        {!initiale && (
          <button type="button" onClick={() => setOuvert(false)} className="text-sm text-[var(--encre-faible)] hover:underline">
            Annuler
          </button>
        )}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={libelle}>Fournisseur</span>
          <select value={fournisseurId} onChange={(e) => choisirFournisseur(e.target.value)} className={CLASSE_CHAMP}>
            <option value="" disabled>
              Choisir…
            </option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={libelle}>Livrer au dépôt</span>
          <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={CLASSE_CHAMP}>
            {depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={libelle}>Date de commande</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CLASSE_CHAMP} />
        </label>
        <label className="block">
          <span className={libelle}>Livraison attendue</span>
          <input type="date" value={livraison} min={date} onChange={(e) => setLivraison(e.target.value)} className={CLASSE_CHAMP} />
        </label>
      </div>
      <EditeurLignes lignes={lignes} onChange={setLignes} articles={articles} fournisseurId={fournisseurId || null} />
      <label className="mt-4 block">
        <span className={libelle}>Notes pour le fournisseur</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Conditions, lieu de livraison, contact…" className={CLASSE_CHAMP} />
      </label>
      {resultat && <Retour resultat={resultat} />}
      <div className="mt-4 flex justify-end">
        <button type="button" disabled={enCours || !fournisseurId} onClick={enregistrer} className="h-cible rounded-lg bg-marque-500 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {enCours ? "Enregistrement…" : initiale ? "Enregistrer les modifications" : "Préparer le brouillon"}
        </button>
      </div>
    </section>
  );
}
