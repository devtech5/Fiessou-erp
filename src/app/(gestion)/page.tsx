import type { Metadata } from "next";

import { CarteIndicateur, EnTetePage } from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import { piecesComptabilisees } from "@/modules/comptabilite/actions";
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

export default async function PageTableauDeBord() {
  const passees = await piecesComptabilisees();
  const liste = alertes(passees);
  const activite = activiteDuJour();
  const soldes = tresorerie();

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
          Le float du guichet figure ici bien qu&apos;il ne soit pas de la
          trésorerie au sens comptable : c&apos;est de la valeur immobilisée chez
          un opérateur, sortie de votre poche et dont vous ne disposez pas.
        </p>
      </section>

      {/* -------------------------------------------------------- activité */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-base font-semibold">Activité</h2>
        <div className={GRILLE}>
          <CarteIndicateur
            libelle="Encaissé"
            valeur={fmtCompact(activite.encaisse)}
            unite="FCFA"
            ton="valide"
            precision="Factures réglées"
          />
          <CarteIndicateur
            libelle="Créances clients"
            valeur={fmtCompact(activite.creances)}
            unite="FCFA"
            ton={activite.creances > 0 ? "alerte" : "valide"}
            precision="Facturé, pas encore encaissé"
          />
          <CarteIndicateur
            libelle="Commissions guichet"
            valeur={fmt(activite.commissionsGuichet)}
            unite="FCFA"
            precision={`${activite.operationsGuichet} opérations · la vraie recette`}
          />
          <CarteIndicateur
            libelle="Valeur du stock"
            valeur={fmtCompact(activite.valeurStock)}
            unite="FCFA"
            precision="Au prix de vente"
          />
        </div>
      </section>

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
