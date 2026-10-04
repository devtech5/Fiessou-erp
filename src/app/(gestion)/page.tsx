import type { Metadata } from "next";

import { CarteIndicateur, EnTetePage } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import { apercuActif } from "@/lib/modules/garde";
import { droitsActifs } from "@/lib/droits/garde";
import type { Droit } from "@/lib/droits/catalogue";
import {
  listerActifs,
  listerEcheances,
  resumeParc,
} from "@/modules/actifs/requetes";
import { etatMissions } from "@/modules/missions/requetes";
import { etatReservations } from "@/modules/reservations/requetes";
import { etatFacturation } from "@/modules/facturation/requetes";
import { soldesParCompte } from "@/modules/comptabilite/requetes";
import { soldesParAuxiliaire } from "@/modules/tiers/requetes";
import { journeeCaisse } from "@/modules/ventes/requetes";
import {
  alertesReapprovisionnement,
  joursRestants,
  resumeStock,
} from "@/modules/stock/requetes";
import {
  activiteDuJour,
  alertes,
  tresorerie,
  type Gravite,
} from "@/lib/tableau-de-bord";

export const metadata: Metadata = { title: "Tableau de bord" };

const TON: Record<Gravite, "danger" | "alerte" | "neutre"> = {
  critique: "danger",
  attention: "alerte",
  information: "neutre",
};

const LIBELLE: Record<Gravite, string> = {
  critique: "Critique",
  attention: "À traiter",
  information: "Pour information",
};

/**
 * Tableau de bord.
 *
 * Trois temps, dans cet ordre : où est l'argent, ce que la journée a produit,
 * ce qui demande une décision. Le constat d'abord, l'action ensuite — les
 * alertes ferment la page parce qu'on les lit pour agir, et qu'on agit après
 * avoir vu où on en est.
 *
 * Les alertes sont classées par gravité et non par module. Quelqu'un qui ouvre
 * son application le matin veut savoir ce qui brûle, pas parcourir un sommaire.
 *
 * Une seule grille pour les trois sections — quatre colonnes en grand écran,
 * deux au-delà du téléphone, le même écart. Trois rythmes différents sur une
 * même page donnent l'impression de trois écrans collés bout à bout.
 */
const GRILLE = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4";

/**
 * Délai de réaction : au-delà, une commande passée aujourd'hui arrive trop
 * tard. Trois jours couvrent le délai courant d'un fournisseur d'Abidjan.
 */
const DELAI_REACTION_JOURS = 3;

/**
 * Droit de consultation qu'exige chaque destination d'alerte.
 *
 * Le tableau de bord traverse tous les modules : sans ce filtre, un caissier
 * y lirait les soldes bancaires et les échéances du parc qu'aucun de ses
 * écrans ne lui montre. L'alerte suit le droit de l'écran vers lequel elle
 * mène — la plus longue racine l'emporte (/commercial/factures avant
 * /commercial).
 */
const DROIT_PAR_RACINE: [string, Droit][] = [
  ["/commercial/factures", "commercial.piece.consulter"],
  ["/commercial", "tiers.fiche.consulter"],
  ["/stock", "stock.article.consulter"],
  ["/reservations", "reservation.consulter"],
  ["/comptabilite", "comptabilite.ecriture.consulter"],
  ["/monnaie", "valeur_electronique.consulter"],
  ["/actifs", "actifs.consulter"],
  ["/missions", "missions.consulter"],
  ["/rh", "personnes.consulter"],
  ["/documents", "documents.consulter"],
];

function droitRequis(href: string): Droit | null {
  const entree = DROIT_PAR_RACINE.find(([racine]) => href === racine || href.startsWith(`${racine}/`));
  return entree ? entree[1] : null;
}

export default async function PageTableauDeBord() {
  const session = await exigerEntreprise();

  // Même borne que l'écran de ventes : la journée du commerce commence à
  // minuit, et les deux écrans doivent annoncer le même encaissé.
  const debutJournee = new Date();
  debutJournee.setHours(0, 0, 0, 0);

  const [
    facturation,
    resume,
    aCommander,
    soldesComptes,
    journee,
    auxiliaires,
    parc,
    echeances,
    missions,
    reservations,
  ] = await Promise.all([
    etatFacturation(session.organizationId),
    resumeStock(session.organizationId),
    alertesReapprovisionnement(session.organizationId),
    soldesParCompte(session.organizationId),
    journeeCaisse(session.organizationId, debutJournee),
    soldesParAuxiliaire(session.organizationId),
    listerActifs(session.organizationId),
    listerEcheances(session.organizationId),
    etatMissions(session.organizationId),
    etatReservations(session.organizationId),
  ]);

  const toutesLesAlertes = alertes(facturation, {
    ruptures: resume.ruptures,
    aCommanderVite: aCommander.filter(
      (alerte) => joursRestants(alerte) <= DELAI_REACTION_JOURS,
    ).length,
    valeur: resume.valeur,
  }, {
    echeancesDepassees: echeances.filter((e) => e.gravite === "depassee").length,
    indisponibles: resumeParc(parc).indisponibles,
  }, missions, reservations);

  // Une alerte encore calculée sur un jeu d'essai ne sort pas d'ici. Elle
  // enverrait l'exploitant relancer une facture qui n'existe pas. Et une
  // alerte ne s'affiche qu'à qui peut ouvrir l'écran vers lequel elle mène.
  const droits = await droitsActifs();
  const voitLaTresorerie = droits.has("comptabilite.ecriture.consulter");
  const liste = (
    apercuActif()
      ? toutesLesAlertes
      : toutesLesAlertes.filter((alerte) => alerte.source === "base")
  ).filter((alerte) => {
    const droit = droitRequis(alerte.href);
    return droit === null || droits.has(droit);
  });

  // Les créances sont la somme des encours non lettrés, tous clients
  // confondus : ce que l'entreprise a facturé et n'a pas encore reçu.
  const creances = [...auxiliaires.values()].reduce(
    (somme, solde) => somme + solde.encoursClient,
    0,
  );

  const activite = activiteDuJour(journee, creances, resume.valeur);
  const soldes = tresorerie(soldesComptes);

  const critiques = liste.filter((a) => a.gravite === "critique");
  const total = soldes.reduce((somme, s) => somme + s.montant, 0);

  return (
    <>
      <EnTetePage
        titre="Tableau de bord"
        sousTitre={
          critiques.length > 0
            ? `${critiques.length} point${critiques.length > 1 ? "s" : ""} critique${critiques.length > 1 ? "s" : ""} à traiter`
            : "Rien de critique aujourd'hui"
        }
      />

      {/* ------------------------------------------------------ trésorerie */}
      {/* Les soldes et l'activité chiffrée relèvent de la comptabilité : un
          caissier n'a pas à lire le solde bancaire de son employeur. */}
      {voitLaTresorerie && (
        <section className="mb-6">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">Où est l&apos;argent</h2>
            <span className="chiffres text-sm font-bold">
              {fmt(total)}{" "}
              <span className="text-xs font-medium text-[var(--encre-faible)]">
                FCFA au total
              </span>
            </span>
          </div>

          <div className={GRILLE}>
            {soldes.map((solde) => (
              <CarteIndicateur
                key={solde.libelle}
                libelle={solde.libelle}
                valeur={fmt(solde.montant)}
                unite="FCFA"
                precision={solde.detail}
              />
            ))}
          </div>

          <p className="mt-2 max-w-[70ch] text-xs text-[var(--encre-faible)]">
            Ces montants sont la somme de vos écritures, pas un solde tenu à part.
            Ce qui n&apos;est pas passé en comptabilité n&apos;y figure pas.
          </p>
        </section>

      )}

      {/* -------------------------------------------------------- activité */}
      {voitLaTresorerie && (
        <section className="mb-6">
          <h2 className="mb-2.5 text-base font-semibold">Activité</h2>
          <div className={GRILLE}>
            <CarteIndicateur
              libelle="Encaissé aujourd'hui"
              valeur={fmtCompact(activite.encaisse)}
              unite="FCFA"
              ton="valide"
              precision={`${fmtEntier(activite.tickets)} ticket${activite.tickets > 1 ? "s" : ""} depuis minuit`}
            />
            <CarteIndicateur
              libelle="Créances clients"
              valeur={fmtCompact(activite.creances)}
              unite="FCFA"
              ton={activite.creances > 0 ? "alerte" : "valide"}
              precision="Facturé, pas encore encaissé"
            />
            <CarteIndicateur
              libelle="Valeur du stock"
              valeur={fmtCompact(activite.valeurStock)}
              unite="FCFA"
              precision="Au coût moyen pondéré"
            />
          </div>
        </section>

      )}

      {/* --------------------------------------------------------- à faire */}
      <section>
        <h2 className="mb-2.5 text-base font-semibold">Ce qui demande une décision</h2>

        {liste.length === 0 ? (
          <p className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--encre-douce)]">
            Rien à signaler. Tout est à jour.
          </p>
        ) : (
          <div className={GRILLE}>
            {liste.map((alerte) => (
              // Le nombre occupe la place de la valeur : c'est lui qui dit
              // l'ampleur avant même qu'on lise le libellé, comme un montant
              // dans un indicateur.
              //
              // La gravité passe dans le libellé de tête plutôt que dans une
              // pastille. La couleur seule ne suffit pas — un exploitant
              // daltonien lirait quatre cartes identiques — et l'écrire là
              // évite d'ajouter une ligne à une carte qui doit rester
              // superposable à celles d'à côté.
              <CarteIndicateur
                key={alerte.id}
                href={alerte.href}
                libelle={`${LIBELLE[alerte.gravite]} · ${alerte.module}`}
                valeur={alerte.nombre !== undefined ? fmtEntier(alerte.nombre) : "—"}
                ton={TON[alerte.gravite]}
                precision={
                  <>
                    <span className="block text-sm font-semibold text-[var(--encre)]">
                      {alerte.titre}
                    </span>
                    <span className="mt-0.5 block">{alerte.detail}</span>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
