import type { Metadata } from "next";

import { BoutonDemonstration } from "@/components/bouton-demonstration";
import {
  CarteIndicateur,
  EnTetePage,
  EtatVide,
  Pastille,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmt, fmtCompact, fmtTauxBp } from "@/lib/format";
import { formaterQuantite, UNITES } from "@/lib/quantite";
import {
  codesParArticle,
  listerArticles,
  listerFamilles,
} from "@/modules/catalogue/requetes";
import { listerTiers } from "@/modules/tiers/requetes";
import { FormulaireArticle } from "./formulaire-article";

export const metadata: Metadata = { title: "Articles" };

export default async function PageArticles() {
  const session = await exigerEntreprise();

  const [catalogue, familles, fournisseurs, codes] = await Promise.all([
    listerArticles(session.organizationId),
    listerFamilles(session.organizationId),
    listerTiers(session.organizationId, "fournisseur"),
    codesParArticle(session.organizationId),
  ]);

  const marchandises = catalogue.filter((a) => a.type === "marchandise");
  const services = catalogue.length - marchandises.length;

  /**
   * Marge brute moyenne, en points de base, sur les seuls articles dont le
   * prix d'achat est connu. Ceux qui n'en ont pas la fausseraient : une marge
   * de 100 % sur un article dont on ignore le coût n'est pas une marge, c'est
   * une information manquante.
   */
  const valorises = catalogue.filter((a) => a.prixAchat > 0);
  const margeMoyenne =
    valorises.length === 0
      ? null
      : Math.round(
          valorises.reduce(
            (somme, a) =>
              somme + ((a.prixVente - a.prixAchat) * 10_000) / a.prixVente,
            0,
          ) / valorises.length,
        );

  return (
    <>
      <EnTetePage
        titre="Articles"
        sousTitre={
          catalogue.length === 0
            ? "Le catalogue est vide"
            : `${marchandises.length} marchandises · ${services} prestations · ${familles.length} familles`
        }
        actions={
          <FormulaireArticle
            familles={familles.map((f) => ({ id: f.id, nom: f.nom }))}
            fournisseurs={fournisseurs.map((f) => ({ id: f.id, nom: f.nom }))}
          />
        }
      />

      {catalogue.length === 0 ? (
        <EtatVide
          titre="Aucun article"
          message="Créez votre premier article, ou installez le catalogue de démonstration — une supérette d'Abidjan avec son rayon frais au poids — pour voir l'écran en fonctionnement."
          actions={<BoutonDemonstration libelle="Installer le catalogue de démonstration" />}
        />
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-3">
            <CarteIndicateur
              libelle="Références"
              valeur={String(catalogue.length)}
              precision={`dont ${services} prestations`}
            />
            <CarteIndicateur
              libelle="Prix de vente moyen"
              valeur={fmtCompact(
                Math.round(
                  catalogue.reduce((somme, a) => somme + a.prixVente, 0) /
                    catalogue.length,
                ),
              )}
              unite="FCFA"
            />
            <CarteIndicateur
              libelle="Marge brute moyenne"
              valeur={margeMoyenne === null ? "—" : fmtTauxBp(margeMoyenne)}
              precision={
                margeMoyenne === null
                  ? "Aucun prix d'achat renseigné"
                  : `Sur ${valorises.length} articles au prix d'achat connu`
              }
            />
          </section>

          <Tableau>
            <thead>
              <tr>
                <Th>Désignation</Th>
                <Th>Référence</Th>
                <Th>Famille</Th>
                <Th aligne="droite">Prix de vente</Th>
                <Th aligne="droite">TVA</Th>
                <Th aligne="droite">Seuil</Th>
                <Th>Fournisseur</Th>
              </tr>
            </thead>
            <tbody>
              {catalogue.map((article) => (
                <tr key={article.id}>
                  <Td fort>
                    {article.designation}
                    {/* Une prestation se signale : elle ne se stocke pas, et
                        elle ne se ventile pas sur le même compte. */}
                    {article.type === "service" && (
                      <span className="ml-2 align-middle">
                        <Pastille ton="marque">Service</Pastille>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="chiffres text-xs text-[var(--encre-faible)]">
                      {article.reference}
                    </span>
                    {codes.get(article.id)?.map((code) => (
                      <span
                        key={code}
                        className="chiffres block text-xs text-[var(--encre-faible)]"
                      >
                        {code}
                      </span>
                    ))}
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--encre-douce)]">
                      {article.familleNom ?? "—"}
                    </span>
                  </Td>
                  <Td aligne="droite" chiffres>
                    {fmt(article.prixVente)}
                    {/* Un prix au kilo doit le dire : « 4 500 » sur du poisson
                        ne veut rien dire sans son unité. */}
                    {UNITES[article.unite].fractionnable && (
                      <span className="text-xs text-[var(--encre-faible)]">
                        {" "}
                        / {UNITES[article.unite].abrege}
                      </span>
                    )}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {article.tauxTvaEffectif === 0 ? (
                      <Pastille>Exonéré</Pastille>
                    ) : (
                      fmtTauxBp(article.tauxTvaEffectif)
                    )}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {article.suiviStock
                      ? formaterQuantite(article.seuilAlerte, article.unite)
                      : "—"}
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--encre-douce)]">
                      {article.fournisseurNom ?? "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tableau>

          {/* Le stock n'est pas une colonne de l'article : il se compte par
              dépôt, et il est la somme des mouvements. Il revient avec le
              module Stock, qui apporte les dépôts et les mouvements. */}
          <p className="mt-3 text-xs text-[var(--encre-faible)]">
            Les quantités en stock apparaîtront ici avec le module Stock : elles
            se comptent par dépôt, à partir des mouvements.
          </p>
        </>
      )}
    </>
  );
}
