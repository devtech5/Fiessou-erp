"use client";

import { useState } from "react";

import { FormulaireRepliable, Retour, useOperation } from "@/components/ui/operations";
import { CLASSE_CHAMP, Champ } from "@/components/ui/primitives";
import { basculerLien, changerStatut, creerEnquete, lienPublic, modifierQuestions } from "@/modules/enquetes/actions";

const AIDE_QUESTIONS =
  "Une question par ligne : libellé | type | * si obligatoire | options. Types : note (1 à 5), nps (0 à 10), choix, oui_non, texte, nombre.";

const EXEMPLE = [
  "Êtes-vous satisfait de l'accueil ? | note | *",
  "Les travaux ont-ils été livrés à temps ? | oui_non | *",
  "Recommanderiez-vous notre entreprise ? | nps",
  "Comment nous avez-vous connus ? | choix | | Bouche à oreille, WhatsApp, Radio, Affiche",
  "Votre commentaire | texte",
].join("\n");

export function FormulaireNouvelleEnquete({ projets, projetParDefaut }: { projets: { id: string; nom: string }[]; projetParDefaut?: string }) {
  return (
    <FormulaireRepliable libelle="Nouvelle enquête" titre="Nouvelle enquête" action={creerEnquete}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ libelle="Titre">
          <input name="titre" required maxLength={120} placeholder="Satisfaction des clients du chantier Cocody" className={CLASSE_CHAMP} />
        </Champ>
        <Champ libelle="Projet" precision="Le projet qui commande l'enquête et en lit les résultats.">
          <select name="projetId" defaultValue={projetParDefaut ?? ""} className={CLASSE_CHAMP}>
            <option value="">Aucun</option>
            {projets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Mot d'accueil" precision="Ce que lit le répondant avant de commencer.">
          <input name="introduction" maxLength={1000} placeholder="Deux minutes pour nous aider à mieux vous servir." className={CLASSE_CHAMP} />
        </Champ>
        <Champ libelle="Objectif de réponses" precision="Facultatif : suit l'avancement de la collecte.">
          <input name="objectif" inputMode="numeric" placeholder="100" className={`${CLASSE_CHAMP} chiffres`} />
        </Champ>
      </div>
      <div className="mt-3">
        <Champ libelle="Questions" precision={AIDE_QUESTIONS}>
          <textarea
            name="questions"
            required
            rows={7}
            defaultValue={EXEMPLE}
            className="w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3.5 py-2 font-mono text-xs outline-none focus:border-marque-500"
          />
        </Champ>
      </div>
    </FormulaireRepliable>
  );
}

export function EditionQuestions({ enqueteId, texteInitial }: { enqueteId: string; texteInitial: string }) {
  const [texte, setTexte] = useState(texteInitial);
  const { resultat, enCours, lancer } = useOperation();
  return (
    <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold">Questionnaire</h2>
      <p className="mb-2 text-xs text-[var(--encre-faible)]">{AIDE_QUESTIONS} Il se fige à la première réponse.</p>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={Math.min(14, Math.max(5, texte.split("\n").length + 1))}
        className="w-full rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-3.5 py-2 font-mono text-xs outline-none focus:border-marque-500"
      />
      <button
        type="button"
        disabled={enCours}
        onClick={() => lancer(() => modifierQuestions(enqueteId, texte))}
        className="mt-2 h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        Enregistrer le questionnaire
      </button>
      <Retour resultat={resultat} />
    </div>
  );
}

export function PilotageEnquete({ enqueteId, statut, lienActif }: { enqueteId: string; statut: "brouillon" | "ouverte" | "close"; lienActif: boolean }) {
  const { resultat, enCours, lancer } = useOperation();
  const [url, setUrl] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  async function obtenirLien() {
    const r = await lienPublic(enqueteId);
    if (r.ok && r.url) {
      setUrl(r.url);
      try {
        await navigator.clipboard.writeText(r.url);
        setCopie(true);
      } catch {
        setCopie(false);
      }
    }
  }

  const bouton = "h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)] disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {statut !== "ouverte" ? (
          <button type="button" disabled={enCours} onClick={() => lancer(() => changerStatut(enqueteId, "ouverte"))} className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50">
            {statut === "brouillon" ? "Ouvrir aux réponses" : "Rouvrir"}
          </button>
        ) : (
          <button type="button" disabled={enCours} onClick={() => lancer(() => changerStatut(enqueteId, "close"))} className={bouton}>
            Clore l&apos;enquête
          </button>
        )}
        {statut === "ouverte" && lienActif && (
          <button type="button" onClick={() => void obtenirLien()} className={bouton}>
            Copier le lien public
          </button>
        )}
        <button type="button" disabled={enCours} onClick={() => lancer(() => basculerLien(enqueteId, !lienActif))} className={bouton}>
          {lienActif ? "Couper le lien public" : "Rétablir le lien public"}
        </button>
      </div>
      {url && (
        <p className="max-w-full break-all rounded-lg bg-[var(--surface-creuse)] px-3 py-2 text-xs">
          {copie ? "Copié : " : ""}
          {url}
        </p>
      )}
      <Retour resultat={resultat} />
    </div>
  );
}
