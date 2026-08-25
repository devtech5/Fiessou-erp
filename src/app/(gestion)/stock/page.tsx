import type { Metadata } from "next";
import Link from "next/link";

import {
  CarteIndicateur,
  EnTetePage,
  Pastille,
  BoutonSecondaire,
} from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import { depuisQuantite } from "@/lib/quantite";
import { CATALOGUE, SEUIL_STOCK_BAS } from "@/lib/fixtures/catalogue";
import { ALERTES, DEPOTS, joursRestants } from "@/lib/fixtures/gestion";

export const metadata: Metadata = { title: "Stock" };

export default function PageStock() {
  const valeurTotale = DEPOTS.reduce((somme, depot) => somme + depot.valeur, 0);
  const unites = DEPOTS.reduce((somme, depot) => somme + depot.unites, 0);
  const ruptures = CATALOGUE.filter((a) => a.stock <= 0).length;
  const bas = CATALOGUE.filter(
    (a) => a.stock > 0 && a.stock <= SEUIL_STOCK_BAS,
  ).length;

  const urgentes = [...ALERTES]
    .sort((a, b) => joursRestants(a) - joursRestants(b))
    .slice(0, 4);

  return (
    <>
      <EnTetePage
        titre="Stock"
        sousTitre="Valorisation, dépôts et alertes"
        actions={
          <>
            <BoutonSecondaire>Exporter</BoutonSecondaire>
            <BoutonSecondaire>Nouvel inventaire</BoutonSecondaire>
          </>
        }
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Valeur du stock"
          valeur={fmtCompact(valeurTotale)}
          unite="FCFA"
          precision={`${fmt(valeurTotale)} au prix de revient`}
        />
        <CarteIndicateur
          libelle="Articles référencés"
          valeur={fmtEntier(CATALOGUE.length)}
          precision={`${fmtEntier(unites)} unités en stock`}
        />
        <CarteIndicateur
          libelle="En rupture"
          valeur={fmtEntier(ruptures)}
          ton={ruptures > 0 ? "danger" : "valide"}
          precision="Aucune vente possible"
        />
        <CarteIndicateur
          libelle="Stock bas"
          valeur={fmtEntier(bas)}
          ton={bas > 0 ? "alerte" : "valide"}
          precision={`Au seuil de ${depuisQuantite(SEUIL_STOCK_BAS)} unités`}
        />
      </section>

      {/* ------------------------------------------------ alertes en tête */}
      <section className="mb-6">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">À commander en priorité</h2>
          <Link
            href="/stock/reapprovisionnement"
            className="text-sm font-medium text-marque-600 hover:underline"
          >
            Voir les {ALERTES.length} alertes
          </Link>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {urgentes.map((alerte) => {
            const jours = joursRestants(alerte);
            return (
              <li
                key={alerte.id}
                className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{alerte.article}</p>
                  <Pastille ton={jours <= 0 ? "danger" : "alerte"}>
                    {jours <= 0
                      ? "Rupture"
                      : `${jours} jour${jours > 1 ? "s" : ""}`}
                  </Pastille>
                </div>
                <p className="mt-1.5 text-xs text-[var(--encre-faible)]">
                  {alerte.fournisseur} · livre en {alerte.delaiJours} jour
                  {alerte.delaiJours > 1 ? "s" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------------------------------------------- valeur par dépôt */}
      <section>
        <h2 className="mb-2.5 text-base font-semibold">Valeur par dépôt</h2>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {DEPOTS.map((depot) => (
            <li
              key={depot.id}
              className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{depot.nom}</p>
                  <p className="chiffres text-xs text-[var(--encre-faible)]">
                    {depot.code} · {depot.ville}
                  </p>
                </div>
                {/* Un seul statut, et il est unique dans la liste. */}
                {depot.parDefaut && <Pastille ton="marque">Par défaut</Pastille>}
              </div>

              <p className="chiffres mt-3 text-lg font-bold">
                {fmtCompact(depot.valeur)}
                <span className="ml-1 text-xs font-medium text-[var(--encre-faible)]">
                  FCFA
                </span>
              </p>
              <p className="chiffres mt-0.5 text-xs text-[var(--encre-faible)]">
                {fmtEntier(depot.articles)} articles · {fmtEntier(depot.unites)} unités
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
