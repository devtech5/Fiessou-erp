import type { Metadata } from "next";

import {
  BoutonPrincipal,
  EnTetePage,
  Pastille,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { fmt, fmtEntier } from "@/lib/format";
import {
  ALERTES,
  joursRestants,
  quantiteSuggeree,
  type AlerteReappro,
} from "@/lib/fixtures/gestion";

export const metadata: Metadata = { title: "Réapprovisionnement" };

/**
 * Alertes de réapprovisionnement, groupées par fournisseur.
 *
 * Le groupement est le point qui manque chez le concurrent : ses quatre-vingt-six
 * alertes défilent en une seule liste, article par article, avec un bouton
 * « Commander » sur chacun. Or on ne commande pas un article, on passe une
 * commande à un fournisseur. Regrouper permet de sortir un bon de commande par
 * fournisseur, ce qui est le geste réel du gérant.
 */
export default function PageReapprovisionnement() {
  const parFournisseur = new Map<string, AlerteReappro[]>();
  for (const alerte of ALERTES) {
    const liste = parFournisseur.get(alerte.fournisseur) ?? [];
    liste.push(alerte);
    parFournisseur.set(alerte.fournisseur, liste);
  }

  // Le fournisseur dont un article manque le plus tôt passe en premier.
  const groupes = [...parFournisseur.entries()].sort(
    ([, a], [, b]) =>
      Math.min(...a.map(joursRestants)) - Math.min(...b.map(joursRestants)),
  );

  return (
    <>
      <EnTetePage
        titre="Réapprovisionnement"
        sousTitre={`${ALERTES.length} articles à commander auprès de ${groupes.length} fournisseurs`}
      />

      <div className="space-y-5">
        {groupes.map(([fournisseur, alertes]) => {
          const total = alertes.reduce(
            (somme, a) => somme + quantiteSuggeree(a) * a.prixAchat,
            0,
          );
          const plusUrgent = Math.min(...alertes.map(joursRestants));

          return (
            <section
              key={fournisseur}
              className="overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--filet)] bg-[var(--surface-creuse)] px-4 py-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    {fournisseur}
                    {plusUrgent <= 0 && <Pastille ton="danger">Rupture en cours</Pastille>}
                  </h2>
                  <p className="chiffres text-xs text-[var(--encre-faible)]">
                    {alertes.length} article{alertes.length > 1 ? "s" : ""} · livraison
                    sous {alertes[0].delaiJours} jour
                    {alertes[0].delaiJours > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-[var(--encre-faible)]">Montant estimé</p>
                    <p className="chiffres text-base font-bold">
                      {fmt(total)}{" "}
                      <span className="text-xs font-medium text-[var(--encre-faible)]">
                        FCFA
                      </span>
                    </p>
                  </div>
                  <BoutonPrincipal>Bon de commande</BoutonPrincipal>
                </div>
              </header>

              <Tableau>
                <thead>
                  <tr>
                    <Th>Article</Th>
                    <Th aligne="droite">Stock</Th>
                    <Th aligne="droite">Ventes 30 j</Th>
                    <Th aligne="droite">Autonomie</Th>
                    <Th aligne="droite">À commander</Th>
                    <Th aligne="droite">Coût estimé</Th>
                  </tr>
                </thead>
                <tbody>
                  {alertes
                    .sort((a, b) => joursRestants(a) - joursRestants(b))
                    .map((alerte) => {
                      const jours = joursRestants(alerte);
                      const quantite = quantiteSuggeree(alerte);
                      return (
                        <tr key={alerte.id}>
                          <Td>{alerte.article}</Td>
                          <Td aligne="droite" chiffres>
                            <span
                              className={
                                alerte.stock <= 0 ? "font-semibold text-danger-600" : ""
                              }
                            >
                              {alerte.stock}
                            </span>
                            <span className="text-[var(--encre-faible)]">
                              {" "}
                              / {alerte.seuil}
                            </span>
                          </Td>
                          <Td aligne="droite" chiffres>
                            {fmtEntier(alerte.ventes30j)}
                          </Td>
                          <Td aligne="droite">
                            <Pastille ton={jours <= 0 ? "danger" : jours <= 3 ? "alerte" : "neutre"}>
                              {jours <= 0 ? "épuisé" : `${jours} j`}
                            </Pastille>
                          </Td>
                          <Td aligne="droite" chiffres fort>
                            {fmtEntier(quantite)}
                          </Td>
                          <Td aligne="droite" chiffres>
                            {fmt(quantite * alerte.prixAchat)}
                          </Td>
                        </tr>
                      );
                    })}
                </tbody>
              </Tableau>
            </section>
          );
        })}
      </div>

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        La quantité suggérée couvre les ventes constatées pendant le délai de
        livraison du fournisseur, plus un mois de réserve, déduction faite du stock
        restant. Elle ne descend jamais sous le seuil de réapprovisionnement défini
        sur l&apos;article.
      </p>
    </>
  );
}
