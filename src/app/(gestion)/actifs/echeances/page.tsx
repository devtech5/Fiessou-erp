import type { Metadata } from "next";

import {
  CarteIndicateur,
  EnTetePage,
  EtatVide,
  Pastille,
  type TonPastille,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmtEntier } from "@/lib/format";
import type { Gravite } from "@/modules/actifs/echeance";
import { listerActifs, listerEcheances } from "@/modules/actifs/requetes";
import type { LigneEcheance } from "@/modules/actifs/requetes";
import type { NatureEcheance } from "@/modules/actifs/schema";

import {
  FormulaireEcheance,
  type OptionActifEcheance,
} from "./formulaire-echeance";

export const metadata: Metadata = { title: "Échéances" };

const LIBELLE_ECHEANCE: Record<NatureEcheance, string> = {
  assurance: "Assurance",
  visite: "Visite technique",
  garantie: "Garantie",
  entretien: "Entretien",
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
function libelleEcheance(echeance: LigneEcheance): string {
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

export default async function PageEcheances() {
  const session = await exigerEntreprise();

  const [echeances, parc] = await Promise.all([
    listerEcheances(session.organizationId),
    listerActifs(session.organizationId),
  ]);

  const depassees = echeances.filter((e) => e.gravite === "depassee").length;
  const proches = echeances.filter((e) => e.gravite === "proche").length;

  const options: OptionActifEcheance[] = parc.map((actif) => ({
    id: actif.id,
    code: actif.code,
    designation: actif.designation,
    uniteCompteur: actif.uniteCompteur,
  }));

  return (
    <>
      <EnTetePage
        titre="Échéances"
        sousTitre="Assurances, visites techniques, garanties et entretiens"
        actions={<FormulaireEcheance actifs={options} />}
      />

      {echeances.length === 0 ? (
        <EtatVide
          titre="Aucune échéance suivie"
          message={
            parc.length === 0
              ? "Ouvrez d'abord une fiche d'actif : une échéance porte toujours sur quelque chose."
              : "Une échéance se déclenche à une date, à un seuil de compteur, ou aux deux — et c'est le premier atteint qui compte. Rouler sans assurance valide n'est pas un retard administratif : c'est une immobilisation au premier contrôle."
          }
        />
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-3">
            <CarteIndicateur
              libelle="Dépassées"
              valeur={fmtEntier(depassees)}
              ton={depassees > 0 ? "danger" : "valide"}
              precision="Actif en infraction ou à risque"
            />
            <CarteIndicateur
              libelle="Proches"
              valeur={fmtEntier(proches)}
              ton={proches > 0 ? "alerte" : "valide"}
              precision="À traiter sans attendre"
            />
            <CarteIndicateur
              libelle="Suivies"
              valeur={fmtEntier(echeances.length)}
              precision="Non honorées, sur tout le parc"
            />
          </section>

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
                    {echeance.actifCode}
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

          <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
            Une échéance qui porte une date ET un seuil de compteur — « tous les
            5 000 km ou six mois » — échoit au premier atteint. Enregistrer
            l&apos;intervention qui l&apos;honore la retire de cette liste sans
            l&apos;effacer : l&apos;historique des visites est précisément ce
            qu&apos;un contrôle demande à voir.
          </p>
        </>
      )}
    </>
  );
}
