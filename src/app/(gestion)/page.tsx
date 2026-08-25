import type { Metadata } from "next";
import Link from "next/link";

import { CarteIndicateur, EnTetePage, Pastille } from "@/components/ui/primitives";
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
 * Il répond à une seule question : qu'est-ce qui demande une décision
 * aujourd'hui ? Tout le reste vit dans les modules.
 *
 * Les alertes sont classées par gravité et non par module. Quelqu'un qui ouvre
 * son application le matin veut savoir ce qui brûle, pas parcourir un sommaire.
 */
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

        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {soldes.map((solde) => (
            <li
              key={solde.libelle}
              className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
            >
              <p className="text-xs text-[var(--encre-faible)]">{solde.libelle}</p>
              <p className="chiffres mt-1 text-xl font-bold">{fmt(solde.montant)}</p>
              <p className="mt-0.5 text-xs text-[var(--encre-faible)]">
                {solde.detail}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-2 max-w-[70ch] text-xs text-[var(--encre-faible)]">
          Le float du guichet figure ici bien qu&apos;il ne soit pas de la
          trésorerie au sens comptable : c&apos;est de la valeur immobilisée chez
          un opérateur, sortie de votre poche et dont vous ne disposez pas.
        </p>
      </section>

      {/* --------------------------------------------------------- à faire */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-base font-semibold">Ce qui demande une décision</h2>

        {liste.length === 0 ? (
          <p className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--encre-douce)]">
            Rien à signaler. Tout est à jour.
          </p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {liste.map((alerte) => (
              <li key={alerte.id}>
                <Link
                  href={alerte.href}
                  className="flex items-start gap-3 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 hover:border-marque-400"
                >
                  {/* Le nombre en tête : c'est lui qui dit l'ampleur avant
                      même qu'on lise le libellé. */}
                  {alerte.nombre !== undefined && (
                    <span
                      className={`chiffres flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                        alerte.gravite === "critique"
                          ? "bg-danger-50 text-danger-600"
                          : alerte.gravite === "attention"
                            ? "bg-alerte-50 text-alerte-600"
                            : "bg-[var(--surface-creuse)] text-[var(--encre-faible)]"
                      }`}
                    >
                      {fmtEntier(alerte.nombre)}
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{alerte.titre}</span>
                      <Pastille ton={TON[alerte.gravite]}>
                        {LIBELLE[alerte.gravite]}
                      </Pastille>
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--encre-douce)]">
                      {alerte.detail}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--encre-faible)]">
                      {alerte.module}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------- activité */}
      <section>
        <h2 className="mb-2.5 text-base font-semibold">Activité</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
    </>
  );
}
