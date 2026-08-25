import type { Metadata } from "next";

import {
  BoutonPrincipal,
  BoutonSecondaire,
  EnTetePage,
  Pastille,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { fmt, fmtEntier } from "@/lib/format";
import { CATALOGUE, SEUIL_STOCK_BAS } from "@/lib/fixtures/catalogue";

export const metadata: Metadata = { title: "Articles" };

export default function PageArticles() {
  const valeur = CATALOGUE.reduce((somme, a) => somme + a.prix * a.stock, 0);

  return (
    <>
      <EnTetePage
        titre="Articles"
        sousTitre={`${CATALOGUE.length} références · ${fmt(valeur)} FCFA au prix de vente`}
        actions={
          <>
            <BoutonSecondaire>Importer</BoutonSecondaire>
            <BoutonSecondaire>Étiquettes</BoutonSecondaire>
            <BoutonPrincipal>Nouvel article</BoutonPrincipal>
          </>
        }
      />

      <Tableau>
        <thead>
          <tr>
            <Th>Désignation</Th>
            <Th>Référence</Th>
            <Th>Catégorie</Th>
            <Th aligne="droite">Prix</Th>
            <Th aligne="droite">Stock</Th>
            <Th aligne="droite">Valeur</Th>
          </tr>
        </thead>
        <tbody>
          {CATALOGUE.map((article) => {
            const rupture = article.stock <= 0;
            const bas = !rupture && article.stock <= SEUIL_STOCK_BAS;

            return (
              <tr key={article.id}>
                <Td fort>{article.designation}</Td>
                <Td>
                  <span className="chiffres text-xs text-[var(--encre-faible)]">
                    {article.sku}
                  </span>
                  {/* Le code-barres du fabricant coexiste avec notre référence
                      interne : les deux répondent au scan. */}
                  {article.codeBarre && (
                    <span className="chiffres block text-xs text-[var(--encre-faible)]">
                      {article.codeBarre}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="text-xs text-[var(--encre-douce)]">
                    {article.categorie}
                  </span>
                </Td>
                <Td aligne="droite" chiffres>
                  {fmt(article.prix)}
                </Td>
                <Td aligne="droite">
                  {rupture ? (
                    <Pastille ton="danger">Rupture</Pastille>
                  ) : bas ? (
                    <Pastille ton="alerte">{fmtEntier(article.stock)}</Pastille>
                  ) : (
                    <span className="chiffres">{fmtEntier(article.stock)}</span>
                  )}
                </Td>
                <Td aligne="droite" chiffres>
                  {fmt(article.prix * article.stock)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Tableau>
    </>
  );
}
