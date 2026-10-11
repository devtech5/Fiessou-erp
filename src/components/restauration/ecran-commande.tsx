"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ModalePaiement } from "@/app/caisse/modale-paiement";
import { SaisieQuantite } from "@/app/caisse/saisie-quantite";
import { TicketImprimable, useReglagesTicket } from "@/app/caisse/ticket-imprimable";
import type { ReglementSaisi } from "@/app/caisse/types";
import { Retour, type Resultat } from "@/components/ui/operations";
import { CLASSE_CHAMP, CLASSE_CHAMP_COMPACT, Pastille, type TonPastille } from "@/components/ui/primitives";
import { totaliser, type LignePanier } from "@/lib/caisse/panier";
import type { DonneesTicket } from "@/lib/caisse/ticket";
import { fmt } from "@/lib/format";
import { ECHELLE_QUANTITE, UNITES, formaterQuantite, montantLigne, type CodeUnite } from "@/lib/quantite";
import {
  annulerCommande,
  annulerLigne,
  avancerLignes,
  encaisserCommande,
  envoyerLignes,
} from "@/modules/restauration/actions";
import {
  ESPACES,
  LIBELLE_ETAT,
  LIBELLE_POSTE,
  libelleDuree,
  posteParDefaut,
  type Espace,
  type Etat,
  type Poste,
} from "@/modules/restauration/calcul";
import type { ArticleCarte } from "@/modules/restauration/requetes";

interface LigneEnvoyeeVue {
  id: string;
  articleId: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  note: string | null;
  poste: Poste;
  etat: Etat;
  motifAnnulation: string | null;
}

interface CommandeVue {
  id: string;
  numero: string;
  statut: "ouverte" | "encaissee" | "annulee";
  repere: string;
  couverts: number | null;
  serveur: string | null;
  minutes: number;
  motifAnnulation: string | null;
  total: number;
  lignes: LigneEnvoyeeVue[];
}

/** Ligne composée sur l'appareil, pas encore partie : elle ne se facture pas. */
interface LigneAComposer {
  id: string;
  article: ArticleCarte;
  quantite: number;
  note: string;
  poste: Poste;
}

const TON_ETAT: Record<Etat, TonPastille> = { envoyee: "neutre", prete: "alerte", servie: "valide", annulee: "danger" };

const LIBELLE_MOYEN: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile money",
  carte: "Carte bancaire",
  banque: "Virement",
  credit: "À crédit",
};

export function EcranCommande({
  espace,
  commande,
  articles,
  postes,
  droits,
  ticket,
}: {
  espace: Espace;
  commande: CommandeVue;
  articles: ArticleCarte[];
  postes: { id: string; nom: string; depotNom: string }[];
  droits: { prendre: boolean; encaisser: boolean; annuler: boolean };
  ticket: { boutique: string; entete: string[]; piedDePage: string | null; logo: string | null; caissier: string };
}) {
  const routeur = useRouter();
  const [aComposer, setAComposer] = useState<LigneAComposer[]>([]);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [aPeser, setAPeser] = useState<ArticleCarte | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const [posteId, setPosteId] = useState(postes[0]?.id ?? "");
  const [paiement, setPaiement] = useState(false);
  const [aImprimer, setAImprimer] = useState<DonneesTicket | null>(null);
  const [annulation, setAnnulation] = useState<{ cible: "commande" } | { cible: "ligne"; id: string } | null>(null);
  const reglagesTicket = useReglagesTicket();

  const ouverte = commande.statut === "ouverte";
  const parArticle = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const categories = useMemo(() => [...new Set(articles.map((a) => a.categorie))].sort(), [articles]);
  const resultats = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return articles.filter(
      (a) => (!categorie || a.categorie === categorie) && (!terme || a.designation.toLowerCase().includes(terme)),
    );
  }, [articles, recherche, categorie]);

  const totalAComposer = aComposer.reduce((s, l) => s + montantLigne(l.article.prix, l.quantite), 0);
  const lignesFacturables = commande.lignes.filter((l) => l.etat !== "annulee");

  function choisir(article: ArticleCarte) {
    if (UNITES[article.unite].fractionnable) {
      setAPeser(article);
      return;
    }
    ajouter(article, ECHELLE_QUANTITE);
  }

  function ajouter(article: ArticleCarte, quantite: number) {
    setAPeser(null);
    setAComposer((actuel) => {
      // Même article, sans note : la quantité monte. Une note fait une ligne à part.
      const existante = actuel.find((l) => l.article.id === article.id && l.note === "");
      if (existante && !UNITES[article.unite].fractionnable) {
        return actuel.map((l) => (l.id === existante.id ? { ...l, quantite: l.quantite + quantite } : l));
      }
      return [...actuel, { id: crypto.randomUUID(), article, quantite, note: "", poste: posteParDefaut(article) }];
    });
  }

  function modifier(id: string, changement: Partial<LigneAComposer>) {
    setAComposer((actuel) =>
      actuel.flatMap((l) => {
        if (l.id !== id) return [l];
        const suivante = { ...l, ...changement };
        return suivante.quantite > 0 ? [suivante] : [];
      }),
    );
  }

  function lancer(op: () => Promise<Resultat>, apres?: () => void) {
    setResultat(null);
    demarrer(async () => {
      const r = await op();
      setResultat(r);
      if (r.ok) {
        apres?.();
        routeur.refresh();
      }
    });
  }

  function envoyer() {
    if (aComposer.length === 0) return;
    const lignes = aComposer.map((l) => ({
      id: l.id,
      articleId: l.article.id,
      quantite: l.quantite,
      note: l.note.trim() || null,
      poste: l.poste,
    }));
    // L'identifiant de chaque ligne vient de l'appareil : renvoyer après un
    // réseau perdu ne double pas la tournée.
    lancer(() => envoyerLignes(espace, commande.id, lignes), () => setAComposer([]));
  }

  /** Lignes au format du panier de caisse : la modale de paiement et le ticket les lisent ainsi. */
  const lignesPanier: LignePanier[] = lignesFacturables.map((l) => ({
    id: l.id,
    articleId: l.articleId,
    designation: l.designation,
    prixUnitaire: l.prixUnitaire,
    quantite: l.quantite,
    unite: (parArticle.get(l.articleId)?.unite ?? "piece") as CodeUnite,
    remise: 0,
  }));

  function encaisser(reglements: ReglementSaisi[]) {
    const especes = reglements.filter((r) => r.moyen === "especes").reduce((s, r) => s + r.montant, 0);
    const poste = postes.find((p) => p.id === posteId);
    setResultat(null);
    demarrer(async () => {
      const r = await encaisserCommande(espace, {
        commandeId: commande.id,
        posteId,
        especesRecues: especes,
        reglements: reglements.map((x) => ({ moyen: x.moyen, montant: x.montant, reference: x.reference ?? null })),
      });
      setResultat(r);
      if (!r.ok) return;
      setPaiement(false);
      setAImprimer({
        boutique: ticket.boutique,
        entete: ticket.entete,
        piedDePage: ticket.piedDePage,
        poste: poste?.nom ?? "Salle",
        caissier: ticket.caissier,
        numero: r.ticket,
        encaisseeLe: r.encaisseeLe,
        lignes: lignesPanier,
        totaux: totaliser(lignesPanier),
        reglements: reglements.map((x) => ({ libelle: LIBELLE_MOYEN[x.moyen] ?? x.moyen, montant: x.montant, reference: x.reference ?? null })),
        especesRecues: especes,
      });
      if (reglagesTicket.auto) setTimeout(() => window.print(), 50);
      routeur.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
      {/* ------------------------------------------------ l'addition */}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{commande.repere}</h1>
            <p className="text-sm text-[var(--encre-douce)]">
              <span className="chiffres">{commande.numero}</span>
              {` · ${libelleDuree(commande.minutes)}`}
              {commande.couverts ? ` · ${commande.couverts} couverts` : ""}
              {commande.serveur ? ` · ${commande.serveur}` : ""}
            </p>
          </div>
          {commande.statut === "encaissee" && <Pastille ton="valide">Encaissée</Pastille>}
          {commande.statut === "annulee" && <Pastille ton="danger">Annulée</Pastille>}
        </div>
        {commande.statut === "annulee" && commande.motifAnnulation && (
          <p className="mb-3 text-sm text-danger-600">Motif : {commande.motifAnnulation}</p>
        )}

        <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
          {commande.lignes.length === 0 && aComposer.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--encre-faible)]">
              Rien de commandé. Choisissez sur la carte, puis envoyez.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--filet)]">
              {commande.lignes.map((l) => (
                <li key={l.id} className={`px-3.5 py-2.5 ${l.etat === "annulee" ? "opacity-55" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${l.etat === "annulee" ? "line-through" : ""}`}>
                        <span className="chiffres">{formaterQuantite(l.quantite, (parArticle.get(l.articleId)?.unite ?? "piece") as CodeUnite)}</span>{" "}
                        {l.designation}
                      </p>
                      {l.note && <p className="text-xs italic text-[var(--encre-douce)]">{l.note}</p>}
                      {l.motifAnnulation && <p className="text-xs text-danger-600">{l.motifAnnulation}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Pastille ton={TON_ETAT[l.etat]}>{LIBELLE_ETAT[l.etat]}</Pastille>
                        <span className="text-[11px] text-[var(--encre-faible)]">{LIBELLE_POSTE[l.poste]}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="chiffres text-sm font-semibold">{fmt(montantLigne(l.prixUnitaire, l.quantite))}</p>
                      {droits.prendre && (l.etat === "envoyee" || l.etat === "prete") && (
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => lancer(() => avancerLignes(espace, [l.id], "servie"))}
                          className="mt-1 text-xs font-medium text-marque-600 hover:underline"
                        >
                          Servie
                        </button>
                      )}
                      {droits.prendre && ouverte && l.etat !== "annulee" && (
                        <button
                          type="button"
                          onClick={() => setAnnulation({ cible: "ligne", id: l.id })}
                          className="ml-2 mt-1 text-xs text-[var(--encre-faible)] hover:text-danger-600 hover:underline"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}

              {aComposer.map((l) => (
                <li key={l.id} className="bg-marque-50/50 px-3.5 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium">{l.article.designation}</p>
                    <p className="chiffres shrink-0 text-sm font-semibold">{fmt(montantLigne(l.article.prix, l.quantite))}</p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {UNITES[l.article.unite].fractionnable ? (
                      <span className="chiffres text-sm">{formaterQuantite(l.quantite, l.article.unite)}</span>
                    ) : (
                      <span className="flex items-center overflow-hidden rounded-lg border border-[var(--filet)]">
                        <button type="button" aria-label="Retirer un" onClick={() => modifier(l.id, { quantite: l.quantite - ECHELLE_QUANTITE })} className="px-2.5 py-1 hover:bg-[var(--surface-creuse)]">
                          −
                        </button>
                        <span className="chiffres min-w-8 text-center text-sm">{l.quantite / ECHELLE_QUANTITE}</span>
                        <button type="button" aria-label="Ajouter un" onClick={() => modifier(l.id, { quantite: l.quantite + ECHELLE_QUANTITE })} className="px-2.5 py-1 hover:bg-[var(--surface-creuse)]">
                          +
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => modifier(l.id, { poste: l.poste === "cuisine" ? "bar" : "cuisine" })}
                      className="rounded border border-[var(--filet)] px-2 py-0.5 text-xs hover:bg-[var(--surface-creuse)]"
                      title="Changer de poste de préparation"
                    >
                      {LIBELLE_POSTE[l.poste]}
                    </button>
                    <input
                      value={l.note}
                      onChange={(e) => modifier(l.id, { note: e.target.value })}
                      placeholder="Note : sans piment…"
                      maxLength={120}
                      className={`${CLASSE_CHAMP_COMPACT} h-8 min-w-0 flex-1 text-xs`}
                    />
                    <button type="button" onClick={() => modifier(l.id, { quantite: 0 })} className="text-xs text-[var(--encre-faible)] hover:text-danger-600">
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[var(--filet)] px-3.5 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Addition</span>
              <span className="chiffres text-xl font-bold">{fmt(commande.total)} F</span>
            </div>
            {aComposer.length > 0 && (
              <p className="mt-0.5 text-right text-xs text-[var(--encre-douce)]">
                + <span className="chiffres">{fmt(totalAComposer)} F</span> à envoyer
              </p>
            )}
          </div>
        </div>

        <Retour resultat={resultat} />

        {ouverte && (
          <div className="mt-3 flex flex-col gap-2">
            {droits.prendre && (
              <button
                type="button"
                disabled={enCours || aComposer.length === 0}
                onClick={envoyer}
                className="h-touche rounded-xl bg-marque-600 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-40"
              >
                {enCours ? "Envoi…" : aComposer.length === 0 ? "Choisissez sur la carte" : `Envoyer ${aComposer.length} ligne${aComposer.length > 1 ? "s" : ""}`}
              </button>
            )}
            {droits.prendre && lignesFacturables.some((l) => l.etat === "prete") && (
              <button
                type="button"
                disabled={enCours}
                onClick={() =>
                  lancer(() =>
                    avancerLignes(
                      espace,
                      lignesFacturables.filter((l) => l.etat === "prete").map((l) => l.id),
                      "servie",
                    ),
                  )
                }
                className="h-cible rounded-lg border border-alerte-600 text-sm font-semibold text-alerte-600 hover:bg-alerte-50"
              >
                Tout ce qui est prêt est servi
              </button>
            )}
            {droits.encaisser && (
              <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-3">
                {postes.length === 0 ? (
                  <p className="text-sm text-[var(--encre-douce)]">
                    Aucun poste n&apos;encaisse la salle.{" "}
                    <Link href={`${ESPACES[espace].racine}/tables`} className="font-medium text-marque-600 hover:underline">
                      Ouvrez-en un
                    </Link>{" "}
                    pour encaisser les tables.
                  </p>
                ) : (
                  <>
                    {postes.length > 1 && (
                      <label className="mb-2 block text-sm">
                        <span className="mb-1 block font-medium">Poste d&apos;encaissement</span>
                        <select value={posteId} onChange={(e) => setPosteId(e.target.value)} className={CLASSE_CHAMP}>
                          {postes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nom} · {p.depotNom}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={enCours || commande.total <= 0 || aComposer.length > 0}
                      onClick={() => setPaiement(true)}
                      className="h-touche w-full rounded-xl bg-valide-600 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                    >
                      Encaisser {fmt(commande.total)} F
                    </button>
                    {aComposer.length > 0 && (
                      <p className="mt-1.5 text-xs text-[var(--encre-faible)]">Envoyez ou retirez les lignes en cours avant d&apos;encaisser.</p>
                    )}
                  </>
                )}
              </div>
            )}
            {droits.annuler && (
              <button
                type="button"
                onClick={() => setAnnulation({ cible: "commande" })}
                className="self-start text-xs text-[var(--encre-faible)] hover:text-danger-600 hover:underline"
              >
                Annuler toute la commande
              </button>
            )}
          </div>
        )}

        {aImprimer && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]"
            >
              Imprimer le ticket {aImprimer.numero}
            </button>
            <Link
              href={ESPACES[espace].racine}
              className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold leading-[var(--h-cible)] text-white hover:bg-marque-700"
            >
              Retour à la salle
            </Link>
          </div>
        )}
      </section>

      {/* ------------------------------------------------- la carte */}
      {ouverte && droits.prendre && (
        <section className="min-w-0">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher sur la carte…"
            className={`${CLASSE_CHAMP} mb-2`}
          />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[null, ...categories].map((c) => (
              <button
                key={c ?? "toutes"}
                type="button"
                onClick={() => setCategorie(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  categorie === c ? "border-marque-600 bg-marque-600 text-white" : "border-[var(--filet)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                {c ?? "Tout"}
              </button>
            ))}
          </div>
          {resultats.length === 0 ? (
            <p className="text-sm text-[var(--encre-faible)]">
              {articles.length === 0 ? "La carte est vide : ajoutez vos plats et boissons dans Stock." : "Rien ne correspond."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {resultats.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => choisir(a)}
                  className="flex min-h-20 flex-col justify-between rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-2.5 text-left hover:border-marque-400 active:scale-[0.99]"
                >
                  <span className="line-clamp-2 text-sm font-medium">{a.designation}</span>
                  <span className="mt-1 flex items-baseline justify-between gap-1">
                    <span className="chiffres text-sm font-semibold">{fmt(a.prix)}</span>
                    {a.stock !== null && (
                      <span className={`chiffres text-[11px] ${a.stock <= 0 ? "text-danger-600" : "text-[var(--encre-faible)]"}`}>
                        {formaterQuantite(a.stock, a.unite)}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {aPeser && (
        <SaisieQuantite
          designation={aPeser.designation}
          prixUnitaire={aPeser.prix}
          unite={aPeser.unite}
          stock={aPeser.stock ?? 0}
          onAnnuler={() => setAPeser(null)}
          onValider={(quantite) => ajouter(aPeser, quantite)}
        />
      )}

      {paiement && (
        <ModalePaiement net={commande.total} lignes={lignesPanier} onAnnuler={() => setPaiement(false)} onValider={encaisser} />
      )}

      {annulation && (
        <DialogueMotif
          titre={annulation.cible === "commande" ? "Annuler toute la commande" : "Annuler la ligne"}
          enCours={enCours}
          onFermer={() => setAnnulation(null)}
          onValider={(motif) =>
            lancer(
              () =>
                annulation.cible === "commande"
                  ? annulerCommande(espace, commande.id, motif)
                  : annulerLigne(espace, annulation.id, motif),
              () => setAnnulation(null),
            )
          }
        />
      )}

      {aImprimer && <TicketImprimable donnees={aImprimer} largeur={reglagesTicket.largeur} logo={ticket.logo} />}
    </div>
  );
}

function DialogueMotif({
  titre,
  enCours,
  onFermer,
  onValider,
}: {
  titre: string;
  enCours: boolean;
  onFermer: () => void;
  onValider: (motif: string) => void;
}) {
  const [motif, setMotif] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onFermer}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onValider(motif);
        }}
        className="w-full max-w-sm rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
      >
        <h2 className="mb-3 text-base font-semibold">{titre}</h2>
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          required
          minLength={3}
          autoFocus
          placeholder="Motif : erreur de saisie, client parti…"
          className={CLASSE_CHAMP}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onFermer} className="h-cible rounded-lg px-3.5 text-sm text-[var(--encre-douce)] hover:underline">
            Retour
          </button>
          <button
            type="submit"
            disabled={enCours || motif.trim().length < 3}
            className="h-cible rounded-lg bg-danger-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirmer l&apos;annulation
          </button>
        </div>
      </form>
    </div>
  );
}
