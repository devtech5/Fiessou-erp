import type { Metadata } from "next";

import {
  BoutonPrincipal,
  CarteIndicateur,
  EnTetePage,
  Pastille,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import {
  DEPARTS,
  LIBELLE_DEPART,
  capacite,
  formaterDuree,
  placesLibres,
  recette,
  tauxRemplissage,
  type StatutDepart,
} from "@/lib/fixtures/billetterie";

export const metadata: Metadata = { title: "Départs" };

const TON: Record<StatutDepart, TonPastille> = {
  ouvert: "valide",
  complet: "alerte",
  embarquement: "marque",
  parti: "neutre",
  annule: "danger",
};

export default function PageDeparts() {
  const duJour = DEPARTS.filter((d) => d.date === "25/08/2026");
  const recetteJour = duJour.reduce((s, d) => s + recette(d), 0);
  const placesVendues = duJour.reduce((s, d) => s + d.siegesVendus.length, 0);
  const placesOffertes = duJour.reduce((s, d) => s + capacite(d), 0);

  return (
    <>
      <EnTetePage
        titre="Départs"
        sousTitre="Gare d'Adjamé · 25 et 26 août 2026"
        actions={<BoutonPrincipal>Programmer un départ</BoutonPrincipal>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Départs du jour"
          valeur={fmtEntier(duJour.length)}
          precision={`${DEPARTS.length - duJour.length} programmés demain`}
        />
        <CarteIndicateur
          libelle="Places vendues"
          valeur={fmtEntier(placesVendues)}
          precision={`Sur ${fmtEntier(placesOffertes)} offertes`}
        />
        <CarteIndicateur
          libelle="Taux de remplissage"
          valeur={`${Math.round((placesVendues / placesOffertes) * 100)}`}
          unite="%"
          ton={placesVendues / placesOffertes > 0.7 ? "valide" : "alerte"}
        />
        <CarteIndicateur
          libelle="Recette du jour"
          valeur={fmtCompact(recetteJour)}
          unite="FCFA"
          ton="valide"
        />
      </section>

      <ul className="grid gap-2 lg:grid-cols-2">
        {DEPARTS.map((depart) => {
          const taux = tauxRemplissage(depart);
          const libres = placesLibres(depart);

          return (
            <li
              key={depart.id}
              className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="chiffres text-xs text-[var(--encre-faible)]">
                    {depart.reference} · {depart.ligne.code}
                  </p>
                  <p className="text-sm font-semibold">
                    {depart.ligne.depart} → {depart.ligne.arrivee}
                  </p>
                </div>
                <Pastille ton={TON[depart.statut]}>
                  {LIBELLE_DEPART[depart.statut]}
                </Pastille>
              </div>

              <p className="chiffres mt-1.5 text-xs text-[var(--encre-douce)]">
                {depart.date} · {depart.heure} · {formaterDuree(depart.ligne.duree)} ·{" "}
                {depart.vehicule}
              </p>

              <div className="mt-3">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-[var(--encre-faible)]">
                    {depart.siegesVendus.length} / {capacite(depart)} places
                  </span>
                  <span className="chiffres font-semibold">{taux} %</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-creuse)]"
                  role="progressbar"
                  aria-valuenow={taux}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Remplissage du départ ${depart.reference}`}
                >
                  <div
                    className={`h-full rounded-full ${
                      taux >= 90 ? "bg-alerte-500" : "bg-marque-600"
                    }`}
                    style={{ width: `${taux}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                <span className="text-[var(--encre-faible)]">
                  {/* Un départ parti n'a plus de places à vendre : ses sièges
                      n'existaient que pour cette date et cette heure. */}
                  {depart.statut === "parti"
                    ? "Départ effectué"
                    : `${libres} place${libres > 1 ? "s" : ""} libre${libres > 1 ? "s" : ""}`}
                </span>
                <span className="chiffres ml-auto font-semibold">
                  {fmt(recette(depart))} FCFA
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
