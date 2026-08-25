"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ajouterArticle,
  definirRemise,
  modifierQuantite,
  retirerLigne,
  totaliser,
  brutLigne,
  type LignePanier,
} from "@/lib/caisse/panier";
import {
  CATEGORIES,
  SEUIL_STOCK_BAS,
  type ArticleDemo,
  type CaissierDemo,
} from "@/lib/fixtures/catalogue";
import { fmt } from "@/lib/format";
import { ECHELLE_QUANTITE, UNITES, formaterQuantite } from "@/lib/quantite";
import { ModalePaiement } from "./modale-paiement";
import { SaisieQuantite } from "./saisie-quantite";

interface Props {
  articles: ArticleDemo[];
  caissier: CaissierDemo;
  nomCaisse: string;
  nomBoutique: string;
}

export function EcranCaisse({ articles, caissier, nomCaisse, nomBoutique }: Props) {
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [enAttente, setEnAttente] = useState<LignePanier[][]>([]);
  const [paiementOuvert, setPaiementOuvert] = useState(false);
  const [enLigne, setEnLigne] = useState(true);
  const [heure, setHeure] = useState<string | null>(null);
  // Article en attente d'une pesée : la vente au poids ne s'ajoute pas
  // d'un clic, il faut lire la balance.
  const [aPeser, setAPeser] = useState<ArticleDemo | null>(null);
  const champRecherche = useRef<HTMLInputElement>(null);

  const totaux = totaliser(lignes);

  // L'horloge ne se rend qu'après montage : sinon le HTML du serveur et celui
  // du client divergent d'une seconde et React signale une hydratation cassée.
  useEffect(() => {
    const tic = () =>
      setHeure(
        new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tic();
    const timer = setInterval(tic, 30_000);
    return () => clearInterval(timer);
  }, []);

  // L'état réseau est affiché en permanence. C'est l'engagement du produit :
  // le caissier doit savoir s'il vend en ligne ou en différé, sans se demander
  // si ses ventes sont perdues.
  useEffect(() => {
    const majuscule = () => setEnLigne(navigator.onLine);
    majuscule();
    window.addEventListener("online", majuscule);
    window.addEventListener("offline", majuscule);
    return () => {
      window.removeEventListener("online", majuscule);
      window.removeEventListener("offline", majuscule);
    };
  }, []);

  const resultats = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return articles.filter((article) => {
      if (categorie && article.categorie !== categorie) return false;
      if (!terme) return true;
      return (
        article.designation.toLowerCase().includes(terme) ||
        article.sku.toLowerCase().includes(terme) ||
        article.codeBarre?.includes(terme)
      );
    });
  }, [articles, recherche, categorie]);

  function encaisser(article: ArticleDemo) {
    if (article.stock <= 0) return;

    // Un article au poids passe par la saisie ; un article à la pièce entre
    // directement, pour ne pas ralentir la file d'attente.
    if (UNITES[article.unite].fractionnable) {
      setAPeser(article);
      return;
    }

    ajouterAuPanier(article, ECHELLE_QUANTITE);
  }

  function ajouterAuPanier(article: ArticleDemo, quantite: number) {
    setLignes((actuel) => ajouterArticle(actuel, article, quantite));
    setRecherche("");
    setAPeser(null);
    champRecherche.current?.focus();
  }

  function validerRecherche(event: React.FormEvent) {
    event.preventDefault();
    // Un caissier tape le début du nom ou scanne un code, puis Entrée.
    // Le premier résultat disponible part au panier sans quitter le clavier.
    const premier = resultats.find((article) => article.stock > 0);
    if (premier) encaisser(premier);
  }

  function mettreEnAttente() {
    if (lignes.length === 0) return;
    setEnAttente((files) => [...files, lignes]);
    setLignes([]);
    champRecherche.current?.focus();
  }

  function reprendreTicket(index: number) {
    const ticket = enAttente[index];
    setEnAttente((files) => files.filter((_, i) => i !== index));
    setLignes((actuel) => [...actuel, ...ticket]);
  }

  function finaliser() {
    setLignes([]);
    setPaiementOuvert(false);
    champRecherche.current?.focus();
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--fond)] text-[var(--encre)]">
      <EnTete
        nomBoutique={nomBoutique}
        nomCaisse={nomCaisse}
        caissier={caissier}
        enLigne={enLigne}
        heure={heure}
        ticketsEnAttente={enAttente.length}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(340px,380px)_1fr]">
        <Panier
          lignes={lignes}
          totaux={totaux}
          enAttente={enAttente}
          onQuantite={(id, q) => setLignes((a) => modifierQuantite(a, id, q))}
          onRemise={(id, r) => setLignes((a) => definirRemise(a, id, r))}
          onRetirer={(id) => setLignes((a) => retirerLigne(a, id))}
          onAttente={mettreEnAttente}
          onReprendre={reprendreTicket}
          onPayer={() => setPaiementOuvert(true)}
        />

        <Catalogue
          resultats={resultats}
          recherche={recherche}
          categorie={categorie}
          champRecherche={champRecherche}
          onRecherche={setRecherche}
          onCategorie={setCategorie}
          onValider={validerRecherche}
          onChoisir={encaisser}
        />
      </div>

      {aPeser && (
        <SaisieQuantite
          designation={aPeser.designation}
          prixUnitaire={aPeser.prix}
          unite={aPeser.unite}
          stock={aPeser.stock}
          onAnnuler={() => setAPeser(null)}
          onValider={(quantite) => ajouterAuPanier(aPeser, quantite)}
        />
      )}

      {paiementOuvert && (
        <ModalePaiement
          net={totaux.net}
          lignes={lignes}
          onAnnuler={() => setPaiementOuvert(false)}
          onValider={finaliser}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ en-tête

function EnTete({
  nomBoutique,
  nomCaisse,
  caissier,
  enLigne,
  heure,
  ticketsEnAttente,
}: {
  nomBoutique: string;
  nomCaisse: string;
  caissier: CaissierDemo;
  enLigne: boolean;
  heure: string | null;
  ticketsEnAttente: number;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--filet)] bg-[var(--surface)] px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{nomBoutique}</p>
        <p className="truncate text-xs text-[var(--encre-faible)]">
          {nomCaisse} · session ouverte
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-block size-2 rounded-full ${
            enLigne ? "bg-valide-500" : "bg-alerte-500"
          }`}
          aria-hidden
        />
        <span className={enLigne ? "text-[var(--encre-douce)]" : "font-semibold text-alerte-600"}>
          {enLigne ? "En ligne" : "Hors ligne — les ventes sont conservées"}
        </span>
      </div>

      {ticketsEnAttente > 0 && (
        <span className="rounded-full bg-alerte-50 px-2.5 py-1 text-xs font-semibold text-alerte-600">
          {ticketsEnAttente} en attente
        </span>
      )}

      <div className="ml-auto flex items-center gap-4 text-xs text-[var(--encre-douce)]">
        <span className="chiffres">{heure ?? "--:--"}</span>
        <span className="font-medium text-[var(--encre)]">{caissier.nom}</span>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------- panier

function Panier({
  lignes,
  totaux,
  enAttente,
  onQuantite,
  onRemise,
  onRetirer,
  onAttente,
  onReprendre,
  onPayer,
}: {
  lignes: LignePanier[];
  totaux: ReturnType<typeof totaliser>;
  enAttente: LignePanier[][];
  onQuantite: (id: string, quantite: number) => void;
  onRemise: (id: string, remise: number) => void;
  onRetirer: (id: string) => void;
  onAttente: () => void;
  onReprendre: (index: number) => void;
  onPayer: () => void;
}) {
  return (
    <section className="flex min-h-0 flex-col border-r border-[var(--filet)] bg-[var(--surface)]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {lignes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-[var(--encre-douce)]">Panier vide</p>
            <p className="text-xs text-[var(--encre-faible)]">
              Cherchez un article, scannez un code, ou touchez le catalogue.
            </p>

            {enAttente.length > 0 && (
              <div className="mt-6 w-full">
                <p className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">
                  Tickets en attente
                </p>
                <div className="flex flex-col gap-1.5">
                  {enAttente.map((ticket, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => onReprendre(index)}
                      className="flex items-center justify-between rounded-lg border border-[var(--filet)] px-3 py-2.5 text-left text-sm hover:border-marque-400"
                    >
                      <span>Ticket {index + 1}</span>
                      <span className="chiffres text-[var(--encre-faible)]">
                        {ticket.length} art.
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--filet)]">
            {lignes.map((ligne) => (
              <li key={ligne.id} className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
                    {ligne.designation}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRetirer(ligne.id)}
                    aria-label={`Retirer ${ligne.designation}`}
                    className="shrink-0 rounded p-1 text-[var(--encre-faible)] hover:bg-danger-50 hover:text-danger-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex items-center overflow-hidden rounded-lg border border-[var(--filet)]">
                    <button
                      type="button"
                      onClick={() =>
                        onQuantite(
                          ligne.id,
                          ligne.quantite - UNITES[ligne.unite].pas,
                        )
                      }
                      aria-label="Diminuer la quantité"
                      className="sans-selection size-9 text-lg leading-none hover:bg-[var(--surface-creuse)]"
                    >
                      −
                    </button>
                    <span className="chiffres w-10 text-center text-sm font-semibold">
                      {formaterQuantite(ligne.quantite, ligne.unite, false)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onQuantite(
                          ligne.id,
                          ligne.quantite + UNITES[ligne.unite].pas,
                        )
                      }
                      aria-label="Augmenter la quantité"
                      className="sans-selection size-9 text-lg leading-none hover:bg-[var(--surface-creuse)]"
                    >
                      +
                    </button>
                  </div>

                  <span className="chiffres text-xs text-[var(--encre-faible)]">
                    × {fmt(ligne.prixUnitaire)}
                    {UNITES[ligne.unite].fractionnable &&
                      ` / ${UNITES[ligne.unite].abrege}`}
                  </span>

                  <span className="chiffres ml-auto text-sm font-semibold">
                    {fmt(brutLigne(ligne))}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-end gap-2">
                  <label className="text-xs text-[var(--encre-faible)]">
                    Remise
                    <input
                      type="number"
                      min={0}
                      max={brutLigne(ligne)}
                      value={ligne.remise || ""}
                      placeholder="0"
                      onChange={(e) => onRemise(ligne.id, Number(e.target.value) || 0)}
                      className="chiffres ml-1.5 w-20 rounded border border-[var(--filet)] bg-transparent px-1.5 py-0.5 text-right text-xs"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--filet)] px-3 py-3">
        <dl className="mb-3 space-y-1 text-sm">
          <div className="flex justify-between text-[var(--encre-douce)]">
            <dt>Total</dt>
            <dd className="chiffres">{fmt(totaux.brut)}</dd>
          </div>
          {totaux.remise > 0 && (
            <div className="flex justify-between text-[var(--encre-douce)]">
              <dt>Remise</dt>
              <dd className="chiffres">− {fmt(totaux.remise)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-[var(--filet)] pt-1.5">
            <dt className="font-semibold">Total à payer</dt>
            <dd className="chiffres text-2xl font-bold">
              {fmt(totaux.net)}{" "}
              <span className="text-sm font-medium text-[var(--encre-faible)]">FCFA</span>
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-[1fr_1.6fr] gap-2">
          <button
            type="button"
            onClick={onAttente}
            disabled={lignes.length === 0}
            className="sans-selection h-touche rounded-xl border border-[var(--filet)] text-sm font-semibold disabled:opacity-40"
          >
            Attente
          </button>
          <button
            type="button"
            onClick={onPayer}
            disabled={lignes.length === 0}
            className="sans-selection h-touche rounded-xl bg-marque-600 text-base font-bold text-white hover:bg-marque-700 disabled:opacity-40"
          >
            Payer
          </button>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- catalogue

function Catalogue({
  resultats,
  recherche,
  categorie,
  champRecherche,
  onRecherche,
  onCategorie,
  onValider,
  onChoisir,
}: {
  resultats: ArticleDemo[];
  recherche: string;
  categorie: string | null;
  champRecherche: React.RefObject<HTMLInputElement | null>;
  onRecherche: (valeur: string) => void;
  onCategorie: (valeur: string | null) => void;
  onValider: (event: React.FormEvent) => void;
  onChoisir: (article: ArticleDemo) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-[var(--filet)] bg-[var(--surface)] px-3 py-2.5">
        <form onSubmit={onValider}>
          <input
            ref={champRecherche}
            value={recherche}
            onChange={(e) => onRecherche(e.target.value)}
            placeholder="Nom, référence ou code-barres — puis Entrée"
            autoFocus
            className="h-cible w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-3.5 text-sm outline-none focus:border-marque-500"
          />
        </form>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <PastilleCategorie active={categorie === null} onClick={() => onCategorie(null)}>
            Tout
          </PastilleCategorie>
          {CATEGORIES.map((nom) => (
            <PastilleCategorie
              key={nom}
              active={categorie === nom}
              onClick={() => onCategorie(nom)}
            >
              {nom}
            </PastilleCategorie>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {resultats.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-[var(--encre-faible)]">
            Aucun article ne correspond.
          </p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {resultats.map((article) => (
              <li key={article.id}>
                <BoutonArticle article={article} onChoisir={onChoisir} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PastilleCategorie({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sans-selection shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
        active
          ? "bg-marque-600 text-white"
          : "bg-[var(--surface-creuse)] text-[var(--encre-douce)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Vignette d'article, en liste dense plutôt qu'en grille de photos.
 *
 * Choix assumé : une grille d'images sur un catalogue de plusieurs centaines de
 * références ne se charge pas sur une connexion de quartier. Le texte suffit
 * pour reconnaître un article, et l'écran reste utilisable dès la première
 * seconde.
 *
 * Un article en rupture est visible mais inactif. Le concurrent laisse les
 * siens cliquables : le caissier encaisse un produit qu'il n'a pas en rayon.
 */
function BoutonArticle({
  article,
  onChoisir,
}: {
  article: ArticleDemo;
  onChoisir: (article: ArticleDemo) => void;
}) {
  const rupture = article.stock <= 0;
  const bas = !rupture && article.stock <= SEUIL_STOCK_BAS;

  return (
    <button
      type="button"
      disabled={rupture}
      onClick={() => onChoisir(article)}
      aria-label={
        rupture
          ? `${article.designation} — en rupture, indisponible`
          : `${article.designation}, ${article.prix} francs`
      }
      className={`sans-selection flex h-full w-full flex-col justify-between gap-2 rounded-xl border p-3 text-left transition ${
        rupture
          ? "cursor-not-allowed border-[var(--filet)] opacity-45"
          : "border-[var(--filet)] bg-[var(--surface)] hover:border-marque-400 hover:bg-[var(--surface-creuse)] active:scale-[0.99]"
      }`}
    >
      <span className="text-sm font-medium leading-snug">{article.designation}</span>

      <span className="flex items-end justify-between gap-2">
        <span className="chiffres text-base font-bold">
          {fmt(article.prix)}
          <span className="ml-1 text-xs font-medium text-[var(--encre-faible)]">FCFA</span>
        </span>

        {rupture ? (
          <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-600">
            Rupture
          </span>
        ) : (
          <span
            className={`chiffres rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              bas
                ? "bg-alerte-50 text-alerte-600"
                : "bg-[var(--surface-creuse)] text-[var(--encre-faible)]"
            }`}
          >
            {formaterQuantite(article.stock, article.unite, false)}
          </span>
        )}
      </span>
    </button>
  );
}
