import Link from "next/link";

import { ActionsPrestation } from "@/components/prestataires/formulaires";
import { EtatVide, Pastille, type TonPastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { STATUTS_PRESTATION, type CompteCharge, type StatutPrestation } from "@/modules/prestataires/calcul";
import type { PrestationAffichee } from "@/modules/prestataires/creation";

const TON: Record<StatutPrestation, TonPastille> = {
  demandee: "alerte",
  confirmee: "marque",
  realisee: "valide",
  payee: "neutre",
  annulee: "neutre",
};

const JOUR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Abidjan" });

/** Prestations, de la plus récente à la plus ancienne, avec leurs gestes. */
export function ListePrestations({
  prestations,
  compteDefaut,
  comptes,
  peutGerer,
  peutPayer,
  avecPrestataire,
}: {
  prestations: (PrestationAffichee & { compteDefaut?: CompteCharge })[];
  compteDefaut: CompteCharge;
  comptes: { id: string; nom: string }[];
  peutGerer: boolean;
  peutPayer: boolean;
  avecPrestataire: boolean;
}) {
  if (prestations.length === 0) {
    return <EtatVide titre="Aucune prestation" message="Confiez une prestation : elle se suit de la demande au paiement, et l'avis laissé à la fin nourrit la note du prestataire." />;
  }
  return (
    <ul className="divide-y divide-[var(--filet)] rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
      {prestations.map((x) => (
        <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="chiffres text-[var(--encre-douce)]">{x.numero}</span>
              {x.objet}
              <Pastille ton={TON[x.statut]}>{STATUTS_PRESTATION[x.statut]}</Pastille>
            </p>
            <p className="mt-0.5 text-xs text-[var(--encre-douce)]">
              {[
                avecPrestataire ? x.prestataire : null,
                x.lieu,
                x.prevueLe ? `prévue le ${JOUR.format(new Date(`${x.prevueLe}T12:00:00Z`))}` : null,
                x.montantConvenu !== null ? `${fmt(x.montantConvenu)} F convenus` : null,
                x.montantPaye !== null ? `${fmt(x.montantPaye)} F payés${x.retenue ? ` dont ${fmt(x.retenue)} F retenus` : ""} (${x.ecritureNumero})` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {x.note && (
              <p className="mt-1 text-xs">
                <span className="text-alerte-500">{"★".repeat(x.note)}</span>
                {x.avis && <span className="ml-1 text-[var(--encre-douce)]">« {x.avis} »</span>}
              </p>
            )}
            {x.motifAnnulation && <p className="mt-1 text-xs text-[var(--encre-faible)]">Annulée : {x.motifAnnulation}</p>}
            {avecPrestataire && (
              <Link href={`/prestataires/${x.prestataireId}`} className="mt-1 inline-block text-xs text-marque-600 hover:underline">
                Fiche du prestataire
              </Link>
            )}
          </div>
          <div className="w-full sm:w-auto sm:min-w-[22rem]">
            <ActionsPrestation
              id={x.id}
              statut={x.statut}
              note={x.note}
              montantConvenu={x.montantConvenu}
              compteDefaut={x.compteDefaut ?? compteDefaut}
              comptes={comptes}
              peutGerer={peutGerer}
              peutPayer={peutPayer}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
