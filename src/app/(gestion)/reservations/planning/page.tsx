import type { Metadata } from "next";

import { CarteIndicateur, EnTetePage } from "@/components/ui/primitives";
import { fmtEntier } from "@/lib/format";
import {
  JOURS_PLANNING,
  OCCUPATION,
  RESSOURCES,
  disponibleLe,
} from "@/lib/fixtures/reservations";

export const metadata: Metadata = { title: "Planning" };

/**
 * Planning de disponibilité.
 *
 * La règle du module tient dans cette grille : on ne loue jamais un exemplaire
 * qui n'existe pas. Chaque case indique ce qu'il RESTE, pas un simple
 * « occupé ».
 *
 * La nuance compte. Un parc de douze lots de chaises dont quatre sont sortis
 * reste largement disponible ; réduire l'état d'une ressource à un booléen
 * interdirait la moitié des locations possibles. Inversement, une chambre est
 * unique : elle bascule à zéro dès la première réservation.
 */
export default function PagePlanning() {
  const louables = RESSOURCES.filter((r) => r.etat !== "retire");

  const capacite = louables.reduce((s, r) => s + r.quantite, 0);
  const prisAujourdhui = OCCUPATION.filter((o) => o.index === 0).reduce(
    (s, o) => s + o.pris,
    0,
  );
  const tauxOccupation = Math.round((prisAujourdhui / capacite) * 100);

  const completAujourdhui = louables.filter(
    (r) => disponibleLe(r, 0) <= 0,
  ).length;

  return (
    <>
      <EnTetePage
        titre="Planning"
        sousTitre="Disponibilité sur quatorze jours, à partir du 25 août 2026"
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <CarteIndicateur
          libelle="Capacité du parc"
          valeur={fmtEntier(capacite)}
          precision={`${louables.length} ressources louables`}
        />
        <CarteIndicateur
          libelle="Occupation du jour"
          valeur={`${tauxOccupation}`}
          unite="%"
          ton={tauxOccupation > 80 ? "alerte" : "valide"}
          precision={`${prisAujourdhui} exemplaires sortis`}
        />
        <CarteIndicateur
          libelle="Complètes aujourd'hui"
          valeur={fmtEntier(completAujourdhui)}
          ton={completAujourdhui > 0 ? "alerte" : "valide"}
          precision="Plus rien à louer"
        />
      </section>

      <div className="overflow-x-auto rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-[var(--filet)] bg-[var(--surface-creuse)] px-3.5 py-2 text-left text-xs font-semibold text-[var(--encre-faible)]">
                Ressource
              </th>
              {JOURS_PLANNING.map((jour) => (
                <th
                  key={jour.cle}
                  className={`border-b border-[var(--filet)] px-1 py-2 text-center text-xs font-semibold ${
                    jour.weekend
                      ? "bg-[var(--surface-creuse)] text-[var(--encre-faible)]"
                      : "bg-[var(--surface-creuse)] text-[var(--encre-douce)]"
                  }`}
                >
                  <span className="block text-[10px] font-normal opacity-70">
                    {jour.libelleJour}
                  </span>
                  <span className="chiffres">{jour.jour}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {louables.map((ressource) => (
              <tr key={ressource.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-r border-[var(--filet)] bg-[var(--surface)] px-3.5 py-2 text-left font-normal"
                >
                  <span className="block text-sm font-medium">
                    {ressource.designation}
                  </span>
                  <span className="chiffres block text-xs text-[var(--encre-faible)]">
                    {ressource.code} · {ressource.quantite} exemplaire
                    {ressource.quantite > 1 ? "s" : ""}
                  </span>
                </th>

                {JOURS_PLANNING.map((jour, index) => {
                  const restant = disponibleLe(ressource, index);
                  const complet = restant <= 0;
                  const partiel = restant > 0 && restant < ressource.quantite;

                  return (
                    <td
                      key={jour.cle}
                      title={`${ressource.designation} — ${jour.cle} : ${
                        complet ? "aucun exemplaire libre" : `${restant} libre(s)`
                      }`}
                      className={`chiffres border-b border-[var(--filet)] px-1 py-2 text-center text-xs font-semibold ${
                        complet
                          ? "bg-danger-50 text-danger-600"
                          : partiel
                            ? "bg-alerte-50 text-alerte-600"
                            : jour.weekend
                              ? "text-[var(--encre-faible)]"
                              : "text-[var(--encre-faible)]"
                      }`}
                    >
                      {complet ? "—" : restant}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--encre-faible)]">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-[var(--surface)] ring-1 ring-[var(--filet)]" aria-hidden />
          Entièrement disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-alerte-50" aria-hidden />
          Partiellement réservée
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-danger-50" aria-hidden />
          Complète
        </span>
      </div>

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Le chiffre affiché est le nombre d&apos;exemplaires encore libres ce
        jour-là, pas un état d&apos;occupation. Une ressource en plusieurs
        exemplaires reste louable tant qu&apos;il en reste au moins un.
      </p>
    </>
  );
}
