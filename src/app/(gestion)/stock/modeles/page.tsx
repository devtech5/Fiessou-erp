import type { Metadata } from "next";
import Link from "next/link";

import { CarteIndicateur, EnTetePage, EtatVide, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt } from "@/lib/format";
import { formaterQuantite } from "@/lib/quantite";
import { listerModeles } from "@/modules/catalogue/modeles";
import { listerFamilles } from "@/modules/catalogue/requetes";

import { FormulaireModele } from "./formulaire-modele";

export const metadata: Metadata = { title: "Modèles à variantes" };

/**
 * Modèles à variantes : un vêtement en tailles et couleurs, une chaussure en
 * pointures, un carreau en formats. Chaque combinaison devient un article
 * avec sa référence, son stock et son prix.
 */
export default async function PageModeles() {
  const session = await exigerEntreprise();
  const [modeles, familles, gerer] = await Promise.all([listerModeles(session.organizationId), listerFamilles(session.organizationId), peut("stock.article.gerer")]);
  const variantes = modeles.reduce((s, m) => s + m.variantes, 0);

  return (
    <>
      <EnTetePage titre="Modèles à variantes" sousTitre="Tailles, couleurs, pointures, formats : une référence et un stock par combinaison" />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3">
        <CarteIndicateur libelle="Modèles" valeur={String(modeles.length)} />
        <CarteIndicateur libelle="Variantes" valeur={String(variantes)} precision="Chacune est un article à part entière" />
      </section>

      {gerer && <FormulaireModele familles={familles.map((f) => ({ id: f.id, nom: f.nom }))} />}

      {modeles.length === 0 ? (
        <EtatVide titre="Aucun modèle" message="Créez un modèle et ses axes : les variantes naissent toutes seules, avec des références lisibles comme DERBY-42-NOIR." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Modèle</Th>
              <Th>Axes</Th>
              <Th aligne="droite">Variantes</Th>
              <Th aligne="droite">En stock</Th>
              <Th aligne="droite">Prix de base</Th>
            </tr>
          </thead>
          <tbody>
            {modeles.map((m) => (
              <tr key={m.id}>
                <Td fort>
                  <Link href={`/stock/modeles/${m.id}`} className="hover:underline">
                    {m.designation}
                  </Link>
                  <span className="block font-mono text-[11px] font-normal text-[var(--encre-faible)]">
                    {m.reference}
                    {m.familleNom ? ` · ${m.familleNom}` : ""}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-[var(--encre-douce)]">{m.axes.map((a) => `${a.nom} (${a.valeurs.length})`).join(" × ")}</span>
                </Td>
                <Td aligne="droite" chiffres>
                  {m.variantes}
                </Td>
                <Td aligne="droite" chiffres>
                  {formaterQuantite(m.stock, m.unite)}
                </Td>
                <Td aligne="droite" chiffres>
                  {fmt(m.prixVente)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  );
}
