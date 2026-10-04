import type { Metadata } from "next";

import { CarteIndicateur, EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmtDateIso, fmtEntier } from "@/lib/format";
import { ajouterJours, prisLe } from "@/modules/reservations/calcul";
import { listerRessources, occupations } from "@/modules/reservations/requetes";

export const metadata: Metadata = { title: "Planning" };

const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const DUREE = 14;

/**
 * Planning de disponibilité sur quatorze jours, à partir d'aujourd'hui.
 *
 * Chaque case dit ce qu'il RESTE, pas un simple « occupé » : un parc de douze
 * lots de chaises dont quatre sont sortis reste largement disponible, alors
 * qu'une chambre bascule à zéro dès la première réservation.
 */
export default async function PagePlanning() {
  const session = await exigerEntreprise();
  const debut = new Date().toISOString().slice(0, 10);
  const fin = ajouterJours(debut, DUREE - 1);

  const [parc, prises] = await Promise.all([
    listerRessources(session.organizationId),
    occupations(session.organizationId, debut, fin),
  ]);

  const louables = parc.filter((r) => r.statut === "active");
  const jours = Array.from({ length: DUREE }, (_, i) => {
    const iso = ajouterJours(debut, i);
    const jour = new Date(`${iso}T12:00:00Z`).getUTCDay();
    return { iso, libelle: JOURS[jour], numero: Number(iso.slice(8)), weekend: jour === 0 || jour === 6 };
  });

  const capacite = louables.reduce((s, r) => s + r.quantite, 0);
  const prisAujourdhui = louables.reduce(
    (s, r) => s + prisLe(prises.filter((p) => p.ressourceId === r.id), debut),
    0,
  );
  const completes = louables.filter(
    (r) => r.quantite - prisLe(prises.filter((p) => p.ressourceId === r.id), debut) <= 0,
  ).length;

  return (
    <>
      <EnTetePage titre="Planning" sousTitre={`Disponibilité sur quatorze jours, à partir du ${fmtDateIso(debut)}`} />

      {louables.length === 0 ? (
        <EtatVide titre="Rien à planifier" message="Le planning se remplit dès qu'une ressource louable existe." />
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
            <CarteIndicateur libelle="Capacité du parc" valeur={fmtEntier(capacite)} precision={`${louables.length} ressources louables`} />
            <CarteIndicateur
              libelle="Occupation du jour"
              valeur={`${capacite > 0 ? Math.round((prisAujourdhui * 100) / capacite) : 0}`}
              unite="%"
              precision={`${prisAujourdhui} exemplaires engagés`}
            />
            <CarteIndicateur
              libelle="Complètes aujourd'hui"
              valeur={fmtEntier(completes)}
              ton={completes > 0 ? "alerte" : "valide"}
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
                  {jours.map((jour) => (
                    <th
                      key={jour.iso}
                      className={`border-b border-[var(--filet)] bg-[var(--surface-creuse)] px-1 py-2 text-center text-xs font-semibold ${
                        jour.weekend ? "text-[var(--encre-faible)]" : "text-[var(--encre-douce)]"
                      }`}
                    >
                      <span className="block text-[10px] font-normal opacity-70">{jour.libelle}</span>
                      <span className="chiffres">{jour.numero}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {louables.map((ressource) => {
                  const siennes = prises.filter((p) => p.ressourceId === ressource.id);
                  return (
                    <tr key={ressource.id}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-r border-[var(--filet)] bg-[var(--surface)] px-3.5 py-2 text-left font-normal"
                      >
                        <span className="block text-sm font-medium">{ressource.designation}</span>
                        <span className="chiffres block text-xs text-[var(--encre-faible)]">
                          {ressource.code} · {ressource.quantite} ex.
                        </span>
                      </th>
                      {jours.map((jour) => {
                        const restant = ressource.quantite - prisLe(siennes, jour.iso);
                        const complet = restant <= 0;
                        const partiel = !complet && restant < ressource.quantite;
                        const contrats = siennes
                          .filter((p) => p.debut <= jour.iso && jour.iso <= p.fin)
                          .map((p) => p.numero)
                          .join(", ");
                        return (
                          <td
                            key={jour.iso}
                            title={`${ressource.designation} — ${fmtDateIso(jour.iso)} : ${
                              complet ? "aucun exemplaire libre" : `${restant} libre(s)`
                            }${contrats ? ` · ${contrats}` : ""}`}
                            className={`chiffres border-b border-[var(--filet)] px-1 py-2 text-center text-xs font-semibold ${
                              complet
                                ? "bg-danger-50 text-danger-600"
                                : partiel
                                  ? "bg-alerte-50 text-alerte-600"
                                  : "text-[var(--encre-faible)]"
                            }`}
                          >
                            {complet ? "—" : restant}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
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
        </>
      )}
    </>
  );
}
