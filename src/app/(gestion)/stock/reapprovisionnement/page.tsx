import type { Metadata } from "next";

import {
  BoutonPrincipal,
  EnTetePage,
  EtatVide,
  Pastille,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmt } from "@/lib/format";
import { formaterQuantite, montantLigne } from "@/lib/quantite";
import {
  alertesReapprovisionnement,
  joursRestants,
  quantiteSuggeree,
  type AlerteStock,
} from "@/modules/stock/requetes";

export const metadata: Metadata = { title: "Réapprovisionnement" };

const SANS_FOURNISSEUR = "Sans fournisseur habituel";

/**
 * Alertes de réapprovisionnement, groupées par fournisseur.
 *
 * Le groupement est le point qui manque chez le concurrent : ses quatre-vingt-six
 * alertes défilent en une seule liste, article par article, avec un bouton
 * « Commander » sur chacun. Or on ne commande pas un article, on passe une
 * commande à un fournisseur. Regrouper permet de sortir un bon de commande par
 * fournisseur, ce qui est le geste réel du gérant.
 */
export default async function PageReapprovisionnement() {
  const session = await exigerEntreprise();
  const alertes = await alertesReapprovisionnement(session.organizationId);

  const parFournisseur = new Map<string, AlerteStock[]>();
  for (const alerte of alertes) {
    const cle = alerte.fournisseurNom ?? SANS_FOURNISSEUR;
    const liste = parFournisseur.get(cle) ?? [];
    liste.push(alerte);
    parFournisseur.set(cle, liste);
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
        sousTitre={
          alertes.length === 0
            ? "Aucun article sous son seuil"
            : `${alertes.length} article${alertes.length > 1 ? "s" : ""} à commander auprès de ${groupes.length} fournisseur${groupes.length > 1 ? "s" : ""}`
        }
      />

      {alertes.length === 0 ? (
        <EtatVide
          titre="Rien à commander"
          message="Aucun article suivi n'est passé sous son seuil d'alerte. Les articles sans seuil sont écartés : un seuil à zéro veut dire « pas de réapprovisionnement automatique », comme le frais qu'on achète au marché chaque matin."
        />
      ) : (
        <div className="space-y-5">
          {groupes.map(([fournisseur, lignes]) => {
            const total = lignes.reduce(
              (somme, a) => somme + montantLigne(a.prixAchat, quantiteSuggeree(a)),
              0,
            );
            const plusUrgent = Math.min(...lignes.map(joursRestants));
            const delai = Math.max(...lignes.map((a) => a.delaiJours));

            return (
              <section
                key={fournisseur}
                className="overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--filet)] bg-[var(--surface-creuse)] px-4 py-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      {fournisseur}
                      {plusUrgent <= 0 && (
                        <Pastille ton="danger">Rupture en cours</Pastille>
                      )}
                    </h2>
                    <p className="chiffres text-xs text-[var(--encre-faible)]">
                      {lignes.length} article{lignes.length > 1 ? "s" : ""}
                      {delai > 0 &&
                        ` · livraison sous ${delai} jour${delai > 1 ? "s" : ""}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-[var(--encre-faible)]">
                        Montant estimé
                      </p>
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
                    {[...lignes]
                      .sort((a, b) => joursRestants(a) - joursRestants(b))
                      .map((alerte) => {
                        const jours = joursRestants(alerte);
                        const quantite = quantiteSuggeree(alerte);
                        return (
                          <tr key={alerte.articleId}>
                            <Td>{alerte.designation}</Td>
                            <Td aligne="droite" chiffres>
                              <span
                                className={
                                  alerte.quantite <= 0
                                    ? "font-semibold text-danger-600"
                                    : ""
                                }
                              >
                                {formaterQuantite(alerte.quantite, alerte.unite, false)}
                              </span>
                              <span className="text-[var(--encre-faible)]">
                                {" "}
                                / {formaterQuantite(alerte.seuil, alerte.unite)}
                              </span>
                            </Td>
                            <Td aligne="droite" chiffres>
                              {formaterQuantite(alerte.ventes30j, alerte.unite, false)}
                            </Td>
                            <Td aligne="droite">
                              {/* Un article sans rotation n'a pas d'échéance :
                                  « 0 jour » le ferait remonter avant des
                                  ruptures qui, elles, coûtent une vente. */}
                              <Pastille
                                ton={
                                  !Number.isFinite(jours)
                                    ? "neutre"
                                    : jours <= 0
                                      ? "danger"
                                      : jours <= 3
                                        ? "alerte"
                                        : "neutre"
                                }
                              >
                                {!Number.isFinite(jours)
                                  ? "sans rotation"
                                  : jours <= 0
                                    ? "épuisé"
                                    : `${jours} j`}
                              </Pastille>
                            </Td>
                            <Td aligne="droite" chiffres fort>
                              {formaterQuantite(quantite, alerte.unite)}
                            </Td>
                            <Td aligne="droite" chiffres>
                              {alerte.prixAchat > 0
                                ? fmt(montantLigne(alerte.prixAchat, quantite))
                                : "—"}
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
      )}

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        La quantité suggérée couvre les ventes constatées pendant le délai de
        livraison du fournisseur, plus un mois de réserve, déduction faite du
        stock restant. Elle ne descend jamais sous le seuil défini sur
        l&apos;article. Les ventes viennent des mouvements de stock des trente
        derniers jours, pas d&apos;un compteur tenu à part.
      </p>
    </>
  );
}
