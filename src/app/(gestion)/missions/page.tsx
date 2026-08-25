import type { Metadata } from "next";

import {
  BoutonPrincipal,
  CarteIndicateur,
  EnTetePage,
  Pastille,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmt, fmtEntier } from "@/lib/format";
import {
  LIBELLE_NATURE,
  LIBELLE_STATUT,
  MISSIONS,
  avancement,
  type StatutMission,
} from "@/lib/fixtures/missions";

export const metadata: Metadata = { title: "Missions" };

const TON: Record<StatutMission, TonPastille> = {
  planifiee: "neutre",
  en_cours: "marque",
  terminee: "valide",
  echouee: "danger",
  annulee: "neutre",
};

export default function PageMissions() {
  const enCours = MISSIONS.filter((m) => m.statut === "en_cours");
  const echouees = MISSIONS.filter((m) => m.statut === "echouee");
  const aSynchroniser = MISSIONS.reduce((s, m) => s + m.enAttenteSynchro, 0);
  const facturable = MISSIONS.filter((m) => m.montant).reduce(
    (s, m) => s + (m.montant ?? 0),
    0,
  );

  return (
    <>
      <EnTetePage
        titre="Missions"
        sousTitre="Livraisons, chantiers, collectes et projets"
        actions={<BoutonPrincipal>Nouvelle mission</BoutonPrincipal>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="En cours"
          valeur={fmtEntier(enCours.length)}
          precision={`Sur ${MISSIONS.length} missions suivies`}
        />
        <CarteIndicateur
          libelle="Échouées"
          valeur={fmtEntier(echouees.length)}
          ton={echouees.length > 0 ? "danger" : "valide"}
          precision="À reprogrammer"
        />
        <CarteIndicateur
          libelle="Preuves à remonter"
          valeur={fmtEntier(aSynchroniser)}
          ton={aSynchroniser > 0 ? "alerte" : "valide"}
          precision="Collectées hors connexion"
        />
        <CarteIndicateur
          libelle="Missions facturables"
          valeur={fmt(facturable)}
          unite="FCFA"
          ton="valide"
          precision="Rattachées à un client"
        />
      </section>

      <ul className="grid gap-2 lg:grid-cols-2">
        {MISSIONS.map((mission) => {
          const progression = avancement(mission);
          const etapeCourante =
            mission.etapes.find((e) => !e.faite) ??
            mission.etapes[mission.etapes.length - 1];

          return (
            <li
              key={mission.id}
              className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="chiffres text-xs text-[var(--encre-faible)]">
                    {mission.reference} · {LIBELLE_NATURE[mission.nature]}
                  </p>
                  <p className="truncate text-sm font-semibold">{mission.titre}</p>
                </div>
                <Pastille ton={TON[mission.statut]}>
                  {LIBELLE_STATUT[mission.statut]}
                </Pastille>
              </div>

              <p className="mt-1.5 truncate text-xs text-[var(--encre-douce)]">
                {mission.assigneA} · {mission.lieu}
              </p>

              <div className="mt-3">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-[var(--encre-faible)]">
                    {mission.statut === "terminee"
                      ? "Terminée"
                      : `Étape : ${etapeCourante.libelle}`}
                  </span>
                  <span className="chiffres shrink-0 font-semibold">
                    {progression} %
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-creuse)]"
                  role="progressbar"
                  aria-valuenow={progression}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Avancement de ${mission.reference}`}
                >
                  <div
                    className={`h-full rounded-full ${
                      mission.statut === "echouee" ? "bg-danger-500" : "bg-marque-600"
                    }`}
                    style={{ width: `${progression}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[var(--encre-faible)]">{mission.echeance}</span>

                {/* Les preuves prises hors réseau restent sur l'appareil. Le
                    signaler évite de croire une mission remontée alors qu'elle
                    n'a pas quitté le téléphone du livreur. */}
                {mission.enAttenteSynchro > 0 && (
                  <Pastille ton="alerte">
                    {mission.enAttenteSynchro} à synchroniser
                  </Pastille>
                )}

                {mission.montant && (
                  <span className="chiffres ml-auto font-semibold">
                    {fmt(mission.montant)} FCFA
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
