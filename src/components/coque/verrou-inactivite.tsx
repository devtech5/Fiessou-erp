"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { seDeconnecter } from "@/lib/auth/actions";
import {
  deverrouiller,
  signalerActivite,
  verrouiller,
  type EtatDeverrouillage,
} from "@/lib/auth/actions-verrou";
import { PAS_PRESENCE_MS, inactiviteEcoulee } from "@/lib/auth/verrou";

/**
 * Partagés entre onglets par `localStorage` : l'activité d'un onglet compte
 * pour tous, et le voile tombe — ou se lève — partout à la fois. Sans cela,
 * travailler dans un onglet laisserait l'autre se verrouiller, et déverrouiller
 * l'un laisserait l'autre voilé.
 */
const CLE_ACTIVITE = "fiessou-activite";
const CLE_VERROU = "fiessou-verrou";

/** Gestes qui comptent comme activité. Le clavier et le toucher autant que la souris. */
const GESTES = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;

/** Toutes les dix secondes : le voile tombe au plus dix secondes après l'heure. */
const PAS_CONTROLE_MS = 10_000;

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // Navigation privée ou stockage bloqué : l'onglet se garde seul.
  }
}

interface Props {
  delaiMinutes: number;
  nom: string;
  email: string | null;
  entreprise: string | null;
  /**
   * `verrouiller` pour la gestion. `presence` pour la caisse : ses gestes
   * comptent comme activité, mais elle ne se voile jamais — elle reste ouverte
   * entre deux clients.
   */
  mode?: "verrouiller" | "presence";
  /** Identifiant du conteneur rendu inerte pendant le verrou : le clavier ne passe plus dessous. */
  cible?: string;
}

/**
 * Verrouillage après inactivité.
 *
 * Le voile est opaque, pas flouté : un flou laisse lire un total en gros
 * caractères. Sous le voile, la page reste montée — formulaire à moitié saisi,
 * panier, filtre — et se retrouve intacte au déverrouillage.
 */
export function VerrouInactivite({ delaiMinutes, nom, email, entreprise, mode = "verrouiller", cible }: Props) {
  const [verrouille, setVerrouille] = useState(false);
  const verrouilleRef = useRef(false);
  const derniere = useRef(0);
  const dernierEcrit = useRef(0);
  const dernierSignal = useRef(0);

  const voiler = useCallback((avertirServeur: boolean) => {
    if (verrouilleRef.current) return;
    verrouilleRef.current = true;
    setVerrouille(true);
    ecrire(CLE_VERROU, "1");
    if (avertirServeur) void verrouiller();
  }, []);

  const lever = useCallback(() => {
    const maintenant = Date.now();
    verrouilleRef.current = false;
    derniere.current = maintenant;
    dernierSignal.current = maintenant;
    setVerrouille(false);
    ecrire(CLE_VERROU, "0");
    ecrire(CLE_ACTIVITE, String(maintenant));
  }, []);

  useEffect(() => {
    const maintenant = Date.now();
    // La page vient d'être servie : le serveur a jugé la session ouverte, et
    // ouvrir une page est un geste. Un voile resté inscrit d'avant est périmé.
    derniere.current = maintenant;
    dernierSignal.current = maintenant;
    ecrire(CLE_ACTIVITE, String(maintenant));
    if (mode === "verrouiller") ecrire(CLE_VERROU, "0");

    const derniereConnue = () => Math.max(derniere.current, Number(lire(CLE_ACTIVITE)) || 0);

    const surGeste = () => {
      if (verrouilleRef.current) return;
      const t = Date.now();
      // Contrôle AVANT d'enregistrer : au réveil d'une mise en veille, le
      // premier mouvement de souris arrive avant la minuterie.
      if (mode === "verrouiller" && inactiviteEcoulee(derniereConnue(), t, delaiMinutes)) {
        voiler(true);
        return;
      }
      derniere.current = t;
      if (t - dernierEcrit.current > 5_000) {
        dernierEcrit.current = t;
        ecrire(CLE_ACTIVITE, String(t));
      }
      if (t - dernierSignal.current > PAS_PRESENCE_MS) {
        dernierSignal.current = t;
        void signalerActivite().then((r) => {
          if (r.verrouillee && mode === "verrouiller") voiler(false);
        });
      }
    };

    const controler = () => {
      if (mode !== "verrouiller" || verrouilleRef.current) return;
      if (inactiviteEcoulee(derniereConnue(), Date.now(), delaiMinutes)) voiler(true);
    };

    const surStockage = (e: StorageEvent) => {
      if (e.key !== CLE_VERROU || mode !== "verrouiller") return;
      if (e.newValue === "1") voiler(false);
      else if (e.newValue === "0" && verrouilleRef.current) lever();
    };

    const surVisibilite = () => {
      if (document.visibilityState === "visible") controler();
    };

    for (const g of GESTES) window.addEventListener(g, surGeste, { passive: true, capture: true });
    window.addEventListener("storage", surStockage);
    document.addEventListener("visibilitychange", surVisibilite);
    const minuterie = window.setInterval(controler, PAS_CONTROLE_MS);

    return () => {
      for (const g of GESTES) window.removeEventListener(g, surGeste, { capture: true });
      window.removeEventListener("storage", surStockage);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.clearInterval(minuterie);
    };
  }, [delaiMinutes, mode, voiler, lever]);

  useEffect(() => {
    if (!cible) return;
    const conteneur = document.getElementById(cible);
    if (!conteneur) return;
    conteneur.inert = verrouille;
    if (verrouille && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [verrouille, cible]);

  if (!verrouille) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-verrou"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--fond)] p-4"
    >
      <CarteVerrou nom={nom} email={email} entreprise={entreprise} delaiMinutes={delaiMinutes} onDeverrouille={lever} />
    </div>
  );
}

/**
 * Carte de déverrouillage, commune au voile et à la page `/verrouille` —
 * celle qu'on retrouve en rechargeant, ou en rouvrant l'ordinateur.
 */
export function CarteVerrou({
  nom,
  email,
  entreprise,
  delaiMinutes,
  onDeverrouille,
}: {
  nom: string;
  email: string | null;
  entreprise: string | null;
  delaiMinutes: number;
  onDeverrouille: () => void;
}) {
  const [etat, action, enCours] = useActionState<EtatDeverrouillage, FormData>(deverrouiller, {});
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (etat.ok) onDeverrouille();
    else champ.current?.focus();
  }, [etat, onDeverrouille]);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-[var(--filet)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="mb-5 flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-marque-50 text-marque-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6" aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        <div>
          <h1 id="titre-verrou" className="text-lg font-semibold">Écran verrouillé</h1>
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            {nom}
            {entreprise ? ` · ${entreprise}` : ""}
          </p>
        </div>
        <p className="text-xs text-[var(--encre-douce)]">
          Aucune activité depuis {delaiMinutes} minutes. Votre travail en cours est conservé.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-3">
        {/* Pour le gestionnaire de mots de passe : il retrouve le compte. */}
        {email && <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Mot de passe</span>
          <input
            ref={champ}
            name="motDePasse"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className="h-touche w-full rounded-xl border border-[var(--filet)] bg-[var(--fond)] px-4 text-base outline-none focus:border-marque-500"
          />
        </label>

        {etat.erreur && (
          <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2.5 text-sm font-medium text-danger-600">
            {etat.erreur}
          </p>
        )}

        <button
          type="submit"
          disabled={enCours}
          className="sans-selection h-touche w-full rounded-xl bg-marque-500 text-base font-bold text-white hover:bg-marque-600 disabled:opacity-50"
        >
          {enCours ? "Un instant…" : "Déverrouiller"}
        </button>
      </form>

      <form action={seDeconnecter} className="mt-3 text-center">
        <button type="submit" className="text-sm text-[var(--encre-douce)] underline-offset-2 hover:underline">
          Ce n&apos;est pas moi — se déconnecter
        </button>
      </form>
    </div>
  );
}
