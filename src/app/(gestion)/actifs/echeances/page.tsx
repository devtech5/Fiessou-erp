import type { Metadata } from "next";

import {
  CarteIndicateur,
  EnTetePage,
  Pastille,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmtEntier } from "@/lib/format";
import {
  ECHEANCES,
  LIBELLE_ECHEANCE,
  resteAvantEcheance,
  type EcheanceDemo,
} from "@/lib/fixtures/actifs";

export const metadata: Metadata = { title: "Échéances" };

/**
 * Deux natures d'échéance coexistent et ne se comparent pas.
 *
 *   · calendaire — assurance, visite technique, garantie
 *   · au compteur — entretien déclenché par les kilomètres ou les heures
 *
 * Les traiter pareil est une erreur courante : un véhicule qui roule peu peut
 * dépasser sa date d'assurance sans jamais atteindre son seuil d'entretien, et
 * inversement pour un engin qui tourne en continu.
 */
function urgence(echeance: EcheanceDemo): {
  ton: TonPastille;
  libelle: string;
  rang: number;
} {
  if (echeance.joursRestants !== undefined) {
    const j = echeance.joursRestants;
    if (j < 0) return { ton: "danger", libelle: `Dépassée de ${Math.abs(j)} j`, rang: j };
    if (j <= 30) return { ton: "alerte", libelle: `Dans ${j} j`, rang: j };
    return { ton: "neutre", libelle: `Dans ${j} j`, rang: j };
  }

  const reste = resteAvantEcheance(echeance);
  if (reste === null) return { ton: "neutre", libelle: "—", rang: 9999 };

  const unite = echeance.uniteCompteur ?? "";
  if (reste <= 0)
    return { ton: "danger", libelle: `Dépassée de ${fmtEntier(-reste)} ${unite}`, rang: -1 };
  if (reste <= 500)
    return { ton: "alerte", libelle: `Dans ${fmtEntier(reste)} ${unite}`, rang: 15 };
  return { ton: "neutre", libelle: `Dans ${fmtEntier(reste)} ${unite}`, rang: 120 };
}

export default function PageEcheances() {
  const triees = [...ECHEANCES].sort((a, b) => urgence(a).rang - urgence(b).rang);

  const depassees = ECHEANCES.filter((e) => urgence(e).ton === "danger").length;
  const proches = ECHEANCES.filter((e) => urgence(e).ton === "alerte").length;

  return (
    <>
      <EnTetePage
        titre="Échéances"
        sousTitre="Assurances, visites techniques, garanties et entretiens"
      />

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
          valeur={fmtEntier(ECHEANCES.length)}
          precision="Sur l'ensemble du parc"
        />
      </section>

      <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
        {triees.map((echeance) => {
          const u = urgence(echeance);
          return (
            <li
              key={echeance.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3"
            >
              <Pastille ton={u.ton}>{LIBELLE_ECHEANCE[echeance.nature]}</Pastille>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{echeance.designation}</p>
                <p className="chiffres truncate text-xs text-[var(--encre-faible)]">
                  {echeance.actif}
                  {echeance.date && ` · ${echeance.date}`}
                  {echeance.compteurCible !== undefined &&
                    ` · seuil ${fmtEntier(echeance.compteurCible)} ${echeance.uniteCompteur}`}
                </p>
              </div>

              <span
                className={`chiffres shrink-0 text-sm font-semibold ${
                  u.ton === "danger"
                    ? "text-danger-600"
                    : u.ton === "alerte"
                      ? "text-alerte-600"
                      : "text-[var(--encre-faible)]"
                }`}
              >
                {u.libelle}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Une échéance au compteur ne se compare pas à une échéance calendaire. Un
        véhicule peu roulant dépasse sa date d&apos;assurance sans atteindre son
        seuil d&apos;entretien ; un engin qui tourne en continu fait l&apos;inverse.
      </p>
    </>
  );
}
