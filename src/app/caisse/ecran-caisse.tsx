"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  encaisserFile,
  fileEnAttente,
  poserTicket,
  reserverRang,
} from "@/lib/caisse/file-locale";
import type { DonneesTicket } from "@/lib/caisse/ticket";
import { fmt } from "@/lib/format";
import { ECHELLE_QUANTITE, UNITES, formaterQuantite, versQuantite } from "@/lib/quantite";
import { encaisserTicket, type TicketEntrant } from "@/modules/ventes/actions";
import { ModalePaiement } from "./modale-paiement";
import {
  PanneauSession,
  type AttenduVue,
  type SessionVue,
} from "./panneau-session";
import { SaisieQuantite } from "./saisie-quantite";
import { TicketImprimable, useReglagesTicket } from "./ticket-imprimable";
import type { ArticleCaisse, PosteCaisseVue, ReglementSaisi } from "./types";

/**
 * Seuil d'alerte de rayon, en millièmes d'unité.
 *
 * Volontairement distinct du seuil de réapprovisionnement porté par l'article :
 * celui-ci sert au gérant qui commande, celui-là au caissier qui voit fondre sa
 * pile. Dix unités suffisent à colorer une vignette.
 */
const SEUIL_RAYON = versQuantite(10);

const LIBELLE_MOYEN: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile money",
  carte: "Carte bancaire",
  banque: "Virement",
  credit: "À crédit",
};

interface Props {
  articles: ArticleCaisse[];
  caissier: string;
  poste: PosteCaisseVue;
  nomBoutique: string;
  deviceId: string | null;
  /** Tiroir ouvert sur ce poste. Nul tant que personne ne l'a ouvert. */
  session: SessionVue | null;
  attendu: AttenduVue | null;
}

export function EcranCaisse({
  articles,
  caissier,
  poste,
  nomBoutique,
  deviceId,
  session,
  attendu,
}: Props) {
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [enAttente, setEnAttente] = useState<LignePanier[][]>([]);
  const [paiementOuvert, setPaiementOuvert] = useState(false);
  const [enLigne, setEnLigne] = useState(true);
  const [heure, setHeure] = useState<string | null>(null);
  // Article en attente d'une pesée : la vente au poids ne s'ajoute pas
  // d'un clic, il faut lire la balance.
  const [aPeser, setAPeser] = useState<ArticleCaisse | null>(null);
  // Tickets encaissés que le serveur n'a pas encore acceptés. Affiché en
  // permanence : le caissier doit savoir ce qui n'est pas encore remonté.
  const [enFile, setEnFile] = useState(0);
  const [dernierTicket, setDernierTicket] = useState<string | null>(null);
  // Dernier ticket encaissé, gardé pour la réimpression : le client qui
  // réclame son reçu une minute plus tard ne doit pas obliger à tout refaire.
  const [aImprimer, setAImprimer] = useState<DonneesTicket | null>(null);
  const reglagesTicket = useReglagesTicket();
  const champRecherche = useRef<HTMLInputElement>(null);
  const routeur = useRouter();

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

  // Les familles réellement présentes, et elles seules : une pastille de
  // catégorie qui ne ramène aucun article fait douter le caissier de sa recherche.
  const categories = useMemo(
    () => [...new Set(articles.map((article) => article.categorie))].sort(),
    [articles],
  );

  function encaisser(article: ArticleCaisse) {
    // Une prestation n'a pas de stock : la livraison se vend toujours.
    if (!article.service && article.stock <= 0) return;

    // Un article au poids passe par la saisie ; un article à la pièce entre
    // directement, pour ne pas ralentir la file d'attente.
    if (UNITES[article.unite].fractionnable) {
      setAPeser(article);
      return;
    }

    ajouterAuPanier(article, ECHELLE_QUANTITE);
  }

  function ajouterAuPanier(article: ArticleCaisse, quantite: number) {
    setLignes((actuel) => ajouterArticle(actuel, article, quantite));
    setRecherche("");
    setAPeser(null);
    champRecherche.current?.focus();
  }

  function validerRecherche(event: React.FormEvent) {
    event.preventDefault();
    // Un caissier tape le début du nom ou scanne un code, puis Entrée.
    // Le premier résultat disponible part au panier sans quitter le clavier.
    const premier = resultats.find(
      (article) => article.service || article.stock > 0,
    );
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

  /**
   * Encaisse le ticket.
   *
   * L'ordre compte, et il est le même que celui du terrain : le ticket est
   * numéroté et écrit EN LOCAL, puis seulement envoyé. Le caissier rend la
   * monnaie sans attendre la réponse du serveur — il n'y a rien à attendre, la
   * vente existe déjà.
   */
  async function finaliser(reglements: ReglementSaisi[]) {
    if (lignes.length === 0) return;

    const especes = reglements
      .filter((reglement) => reglement.moyen === "especes")
      .reduce((somme, reglement) => somme + reglement.montant, 0);

    const numeroSeq = await reserverRang(poste.id, poste.dernierRang);
    const numero = `${poste.prefixe}${String(numeroSeq).padStart(6, "0")}`;
    const id = crypto.randomUUID();
    const encaisseeLe = new Date().toISOString();

    const payload = {
      id,
      caisseId: poste.id,
      numeroSeq,
      encaisseeLe,
      especesRecues: especes,
      deviceId,
      lignes: lignes.map((ligne) => ({
        id: crypto.randomUUID(),
        articleId: ligne.articleId,
        designation: ligne.designation,
        quantite: ligne.quantite,
        prixUnitaire: ligne.prixUnitaire,
        remise: ligne.remise,
      })),
      reglements: reglements.map((reglement) => ({
        moyen: reglement.moyen,
        montant: reglement.montant,
        reference: reglement.reference ?? null,
      })),
    };

    await poserTicket({
      id,
      organizationId: "",
      caisseId: poste.id,
      numeroSeq,
      numero,
      encaisseeLe,
      totalTtc: totaux.net,
      payload,
      etat: "en_attente",
      tentatives: 0,
    });

    setAImprimer({
      boutique: nomBoutique,
      poste: poste.nom,
      caissier,
      numero,
      encaisseeLe,
      lignes: lignes.map((ligne) => ({ ...ligne })),
      totaux,
      reglements: reglements.map((reglement) => ({
        libelle: LIBELLE_MOYEN[reglement.moyen] ?? reglement.moyen,
        montant: reglement.montant,
        reference: reglement.reference ?? null,
      })),
      especesRecues: especes,
    });
    if (reglagesTicket.auto) declencherImpression();

    setDernierTicket(numero);
    setLignes([]);
    setPaiementOuvert(false);
    champRecherche.current?.focus();

    // L'envoi part après avoir rendu la main : le caissier enchaîne, la file
    // se vide toute seule.
    void viderFile();
  }

  /**
   * Lance l'impression au prochain rendu : le ticket doit être dans le DOM
   * avant que le navigateur ouvre sa boîte d'impression.
   */
  function declencherImpression() {
    setTimeout(() => window.print(), 50);
  }

  const viderFile = useCallback(async () => {
    const resultat = await encaisserFile(async (payload) => {
      const reponse = await encaisserTicket(payload as TicketEntrant);
      return reponse.ok
        ? { ok: true }
        : { ok: false, message: reponse.message };
    });

    setEnFile(resultat.restants + resultat.refuses);
    if (resultat.envoyes > 0) routeur.refresh();
  }, [routeur]);

  // Au retour du réseau, la file part d'elle-même. Un caissier n'a pas à savoir
  // qu'il existe un bouton « synchroniser » — et il ne le trouverait pas un
  // samedi de marché.
  useEffect(() => {
    void fileEnAttente().then((file) => setEnFile(file.length));
    if (enLigne) void viderFile();
  }, [enLigne, viderFile]);

  return (
    <div className="flex h-dvh flex-col bg-[var(--fond)] text-[var(--encre)]">
      <EnTete
        nomBoutique={nomBoutique}
        nomCaisse={`${poste.nom} · ${poste.depotNom}`}
        caissier={caissier}
        enLigne={enLigne}
        heure={heure}
        ticketsEnAttente={enAttente.length}
        enFile={enFile}
        dernierTicket={dernierTicket}
        session={session}
        attendu={attendu}
        poste={poste}
        reglagesTicket={reglagesTicket}
        peutImprimer={aImprimer !== null}
        onImprimer={declencherImpression}
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
          categories={categories}
        />
      </div>

      {aImprimer && (
        <TicketImprimable donnees={aImprimer} largeur={reglagesTicket.largeur} />
      )}

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
  enFile,
  dernierTicket,
  session,
  attendu,
  poste,
  reglagesTicket,
  peutImprimer,
  onImprimer,
}: {
  reglagesTicket: ReturnType<typeof useReglagesTicket>;
  peutImprimer: boolean;
  onImprimer: () => void;
  nomBoutique: string;
  nomCaisse: string;
  caissier: string;
  enLigne: boolean;
  heure: string | null;
  ticketsEnAttente: number;
  enFile: number;
  dernierTicket: string | null;
  session: SessionVue | null;
  attendu: AttenduVue | null;
  poste: PosteCaisseVue;
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

      {/* Ventes encaissées que le serveur n'a pas encore accusées. Le chiffre
          est montré même à zéro dès qu'il a bougé : un caissier qui a vendu
          hors connexion doit voir sa file se vider, sinon il rappelle le
          gérant pour demander si « c'est bien parti ». */}
      {enFile > 0 && (
        <span className="rounded-full bg-marque-50 px-2.5 py-1 text-xs font-semibold text-marque-600">
          {enFile} ticket{enFile > 1 ? "s" : ""} à remonter
        </span>
      )}

      {/* L'état du tiroir se voit en permanence. Une caisse qu'on oublie
          d'ouvrir se compte le soir sans savoir contre quoi. */}
      <PanneauSession
        poste={{ id: poste.id, code: poste.code, nom: poste.nom }}
        session={session}
        attendu={attendu}
      />

      <div className="ml-auto flex items-center gap-4 text-xs text-[var(--encre-douce)]">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={reglagesTicket.auto}
            onChange={(e) => reglagesTicket.changerAuto(e.target.checked)}
          />
          Imprimer à l&apos;encaissement
        </label>
        <select
          aria-label="Largeur du papier"
          value={reglagesTicket.largeur}
          onChange={(e) =>
            reglagesTicket.changerLargeur(e.target.value === "58" ? 58 : 80)
          }
          className="rounded border border-[var(--filet)] bg-[var(--surface)] px-1.5 py-1"
        >
          <option value={80}>80 mm</option>
          <option value={58}>58 mm</option>
        </select>
        <button
          type="button"
          onClick={onImprimer}
          disabled={!peutImprimer}
          className="rounded border border-[var(--filet)] px-2.5 py-1 font-medium text-[var(--encre)] disabled:opacity-40"
        >
          Réimprimer
        </button>
        {dernierTicket && (
          <span className="chiffres text-valide-600">{dernierTicket}</span>
        )}
        <span className="chiffres">{heure ?? "--:--"}</span>
        <span className="font-medium text-[var(--encre)]">{caissier}</span>
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
  categories,
}: {
  resultats: ArticleCaisse[];
  categories: string[];
  recherche: string;
  categorie: string | null;
  champRecherche: React.RefObject<HTMLInputElement | null>;
  onRecherche: (valeur: string) => void;
  onCategorie: (valeur: string | null) => void;
  onValider: (event: React.FormEvent) => void;
  onChoisir: (article: ArticleCaisse) => void;
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
          {categories.map((nom) => (
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
  article: ArticleCaisse;
  onChoisir: (article: ArticleCaisse) => void;
}) {
  // Une prestation n'a pas de stock à épuiser : la livraison se vend toujours.
  // L'afficher « en rupture » interdirait de facturer un montage.
  const rupture = !article.service && article.stock <= 0;
  const bas = !rupture && !article.service && article.stock <= SEUIL_RAYON;

  return (
    <button
      type="button"
      disabled={rupture}
      onClick={() => onChoisir(article)}
      aria-label={
        rupture
          ? `${article.designation} — en rupture, indisponible`
          : `${article.designation}, ${article.prix} francs${article.service ? ", prestation" : ""}`
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
        ) : article.service ? (
          <span className="rounded-full bg-marque-50 px-2 py-0.5 text-[11px] font-semibold text-marque-600">
            Service
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
