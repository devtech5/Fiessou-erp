import type { Metadata } from "next";
import Link from "next/link";

import { BoutonMenage, FormulaireSejour } from "@/components/hotel/formulaires";
import { CarteIndicateur, EnTetePage, EtatVide, Pastille, type TonPastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtEntier } from "@/lib/format";
import { LIBELLE_ETAT, tauxOccupation, type EtatChambre } from "@/modules/hotellerie/calcul";
import { aujourdHuiPour } from "@/modules/hotellerie/creation";
import { clientsHotel, tableauDesChambres, type ChambreVue } from "@/modules/hotellerie/requetes";
import { ajouterJours } from "@/modules/reservations/calcul";

export const metadata: Metadata = { title: "Chambres du jour" };

const TON: Record<EtatChambre, TonPastille> = {
  occupee: "marque",
  depart: "alerte",
  arrivee: "valide",
  a_nettoyer: "alerte",
  libre: "neutre",
  hors_service: "danger",
};

const JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const court = (iso: string) => COURT.format(new Date(`${iso}T12:00:00Z`));

function Tuile({ chambre, menage }: { chambre: ChambreVue; menage: boolean }) {
  const s = chambre.sejour;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="chiffres text-lg font-semibold leading-tight">{chambre.code}</p>
          <p className="text-xs text-[var(--encre-faible)]">{chambre.categorie ?? chambre.designation}</p>
        </div>
        <Pastille ton={TON[chambre.etat]}>{LIBELLE_ETAT[chambre.etat]}</Pastille>
      </div>
      {s ? (
        <Link href={`/hotel/sejours/${s.id}`} className="rounded-lg bg-[var(--surface-creuse)] px-2.5 py-2 text-sm hover:underline">
          <span className="block truncate font-medium">{s.client}</span>
          <span className="chiffres block text-xs text-[var(--encre-faible)]">
            {court(s.arrivee)} → {court(s.depart)}
          </span>
        </Link>
      ) : (
        <p className="px-0.5 text-sm text-[var(--encre-faible)]">{chambre.capacite} pers.</p>
      )}
      {menage && chambre.statut === "active" && chambre.etat !== "occupee" && chambre.etat !== "depart" && (
        <div className="mt-auto flex justify-end">
          <BoutonMenage ressourceId={chambre.id} menage={chambre.menage} />
        </div>
      )}
    </li>
  );
}

/** La réception du matin : qui arrive, qui part, quelles chambres faire. */
export default async function PageChambresDuJour() {
  const session = await exigerEntreprise();
  const jour = await aujourdHuiPour(session.organizationId);
  const [chambres, clients, reserver, menage, gererChambres] = await Promise.all([
    tableauDesChambres(session.organizationId, jour),
    clientsHotel(session.organizationId),
    peut("hotellerie.sejour.gerer"),
    peut("hotellerie.menage"),
    peut("hotellerie.chambre.gerer"),
  ]);

  const compte = (etat: EtatChambre) => chambres.filter((c) => c.etat === etat).length;
  const occupees = compte("occupee") + compte("depart");
  const enService = chambres.filter((c) => c.statut === "active" || c.etat === "occupee" || c.etat === "depart").length;
  const etages = [...new Set(chambres.map((c) => c.etage ?? ""))];

  return (
    <>
      <EnTetePage
        titre="Chambres du jour"
        sousTitre={JOUR.format(new Date(`${jour}T12:00:00Z`))}
        actions={
          reserver ? (
            <FormulaireSejour
              chambres={chambres
                .filter((c) => c.statut === "active")
                .map((c) => ({ id: c.id, code: c.code, libelle: c.categorie ?? c.designation, capacite: c.capacite }))}
              clients={clients}
              aujourdHui={jour}
              demain={ajouterJours(jour, 1)}
            />
          ) : undefined
        }
      />

      {chambres.length === 0 ? (
        <EtatVide
          titre="Aucune chambre"
          message={
            gererChambres
              ? "Déclarez vos chambres dans l'onglet Chambres et tarifs : numéro, étage, capacité et prix de la nuit."
              : "Aucune chambre n'est encore déclarée. Demandez au gérant de les ajouter."
          }
        />
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2">
            <CarteIndicateur libelle="Occupation" valeur={`${tauxOccupation(occupees, enService)} %`} precision={`${occupees} chambre${occupees > 1 ? "s" : ""} sur ${enService}`} ton="marque" />
            <CarteIndicateur libelle="Arrivées attendues" valeur={fmtEntier(compte("arrivee"))} ton={compte("arrivee") > 0 ? "valide" : "neutre"} />
            <CarteIndicateur libelle="Départs" valeur={fmtEntier(compte("depart"))} ton={compte("depart") > 0 ? "alerte" : "neutre"} precision="Prévus aujourd'hui ou dépassés" />
            <CarteIndicateur libelle="À nettoyer" valeur={fmtEntier(compte("a_nettoyer"))} ton={compte("a_nettoyer") > 0 ? "alerte" : "valide"} />
            <CarteIndicateur libelle="Libres et prêtes" valeur={fmtEntier(compte("libre"))} />
          </section>

          {etages.map((etage) => (
            <section key={etage} className="mb-5">
              {etages.length > 1 && <h2 className="mb-2 text-sm font-semibold text-[var(--encre-douce)]">{etage ? `Étage ${etage}` : "Sans étage"}</h2>}
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
                {chambres
                  .filter((c) => (c.etage ?? "") === etage)
                  .map((c) => (
                    <Tuile key={c.id} chambre={c} menage={menage} />
                  ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
