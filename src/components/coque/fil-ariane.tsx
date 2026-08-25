"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { basculerEntreprise } from "@/lib/auth/actions";
import { Selecteur, type OptionSelecteur } from "./selecteur";

interface Props {
  entreprises: OptionSelecteur[];
  entrepriseActive: OptionSelecteur | null;
  /** Exercice comptable courant. Second niveau du fil. */
  exercice: OptionSelecteur | null;
  exercices: OptionSelecteur[];
}

/**
 * Fil d'Ariane à sélecteurs, en tête d'application.
 *
 * Deux niveaux : l'entreprise, puis l'exercice comptable. Le même principe que
 * l'organisation puis le projet chez Vercel, ou l'organisation puis la branche
 * chez Supabase — le contexte de travail reste visible et se change sur place,
 * sans page dédiée.
 *
 * Le basculement passe par une action serveur : c'est la session en base qui
 * porte l'entreprise active, pas un état de navigateur. Un onglet ouvert
 * ailleurs ne doit pas continuer à écrire dans l'entreprise précédente.
 */
export function FilAriane({
  entreprises,
  entrepriseActive,
  exercice,
  exercices,
}: Props) {
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();

  function changerEntreprise(id: string) {
    if (id === entrepriseActive?.id) return;
    // L'action redirige elle-même : un refresh client ne suffisait pas, le
    // layout continuait d'afficher l'entreprise précédente.
    demarrer(() => basculerEntreprise(id));
  }

  return (
    <nav
      aria-label="Contexte de travail"
      className={`flex min-w-0 items-center gap-1 ${enCours ? "opacity-60" : ""}`}
    >
      <Selecteur
        valeur={entrepriseActive}
        options={entreprises}
        placeholderRecherche="Chercher une entreprise…"
        messageVide="Aucune autre entreprise."
        actionCreation={{
          libelle: "Nouvelle entreprise",
          onClick: () => routeur.push("/entreprises/nouvelle"),
        }}
        onChoisir={changerEntreprise}
      />

      {exercice && (
        <>
          <span className="text-[var(--filet)]" aria-hidden>
            /
          </span>
          <Selecteur
            valeur={exercice}
            options={exercices}
            placeholderRecherche="Chercher un exercice…"
            messageVide="Un seul exercice ouvert."
            onChoisir={() => {
              // Le changement d'exercice touchera aux écritures : il attend le
              // module comptable, pas seulement un état d'interface.
            }}
          />
        </>
      )}
    </nav>
  );
}
