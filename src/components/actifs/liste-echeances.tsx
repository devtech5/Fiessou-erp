import { Pastille, type TonPastille } from "@/components/ui/primitives";
import { fmtEntier } from "@/lib/format";
import type { Gravite } from "@/modules/actifs/echeance";
import type { LigneEcheance } from "@/modules/actifs/requetes";
import type { NatureEcheance } from "@/modules/actifs/schema";

export const LIBELLE_ECHEANCE: Record<NatureEcheance, string> = {
  assurance: "Assurance",
  visite: "Visite technique",
  garantie: "Garantie",
  entretien: "Entretien",
  vignette: "Vignette",
  patente: "Patente de transport",
};

const TON: Record<Gravite, TonPastille> = {
  depassee: "danger",
  proche: "alerte",
  a_venir: "neutre",
};

/**
 * Deux natures d'échéance coexistent et ne se comparent pas.
 *
 *   · calendaire — assurance, visite technique, garantie
 *   · au compteur — entretien déclenché par les kilomètres ou les heures
 *
 * Les traiter pareil est une erreur courante : un véhicule qui roule peu peut
 * dépasser sa date d'assurance sans jamais atteindre son seuil d'entretien, et
 * inversement pour un engin qui tourne en continu. `jugerEcheance` retient le
 * PREMIER déclencheur atteint, et c'est lui qu'on affiche.
 */
export function libelleEcheance(echeance: LigneEcheance): string {
  if (echeance.joursRestants !== null) {
    const j = echeance.joursRestants;
    // Le calendrier prime à l'affichage quand il est déjà dépassé : c'est lui
    // qui immobilise au premier contrôle.
    if (j < 0) return `Dépassée de ${j * -1} j`;
    if (echeance.resteCompteur === null || echeance.resteCompteur > 0) {
      return `Dans ${j} j`;
    }
  }

  if (echeance.resteCompteur !== null) {
    const reste = echeance.resteCompteur;
    const unite = echeance.uniteCompteur ?? "";
    return reste <= 0
      ? `Dépassée de ${fmtEntier(-reste)} ${unite}`
      : `Dans ${fmtEntier(reste)} ${unite}`;
  }

  // Un seuil de compteur sur un actif dont aucun relevé n'existe : l'échéance
  // reste visible, mais on ne prétend pas savoir quand elle tombe.
  return "Relevé manquant";
}

/** Échéances non honorées, de la plus urgente à la plus lointaine. Partagée par Actifs et les parcs. */
export function ListeEcheances({ echeances, avecActif = true }: { echeances: LigneEcheance[]; avecActif?: boolean }) {
  return (
    <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
      {echeances.map((echeance) => (
        <li
          key={echeance.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3"
        >
          <Pastille ton={TON[echeance.gravite]}>
            {LIBELLE_ECHEANCE[echeance.nature]}
          </Pastille>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {echeance.libelle ?? echeance.actifDesignation}
            </p>
            <p className="chiffres truncate text-xs text-[var(--encre-faible)]">
              {avecActif ? echeance.actifCode : null}
              {echeance.echeanceLe && ` · ${echeance.echeanceLe}`}
              {echeance.compteurCible !== null &&
                ` · seuil ${fmtEntier(echeance.compteurCible)} ${echeance.uniteCompteur ?? ""}`}
            </p>
          </div>

          <span
            className={`chiffres shrink-0 text-sm font-semibold ${
              echeance.gravite === "depassee"
                ? "text-danger-600"
                : echeance.gravite === "proche"
                  ? "text-alerte-600"
                  : "text-[var(--encre-faible)]"
            }`}
          >
            {libelleEcheance(echeance)}
          </span>
        </li>
      ))}
    </ul>
  );
}
