import type { Metadata } from "next";

import {
  BoutonPrincipal,
  BoutonSecondaire,
  CarteIndicateur,
  EnTetePage,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import { FOURNISSEURS } from "@/lib/fixtures/gestion";

export const metadata: Metadata = { title: "Fournisseurs" };

export default function PageFournisseurs() {
  const volume = FOURNISSEURS.reduce((somme, f) => somme + f.volumeAchats, 0);
  const du = FOURNISSEURS.reduce((somme, f) => somme + f.soldeDu, 0);
  const delaiMoyen =
    FOURNISSEURS.reduce((somme, f) => somme + f.delaiJours, 0) / FOURNISSEURS.length;

  return (
    <>
      <EnTetePage
        titre="Fournisseurs"
        sousTitre={`${FOURNISSEURS.length} fournisseurs référencés`}
        actions={
          <>
            <BoutonSecondaire>Importer</BoutonSecondaire>
            <BoutonPrincipal>Nouveau fournisseur</BoutonPrincipal>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <CarteIndicateur libelle="Volume d'achats" valeur={fmtCompact(volume)} unite="FCFA" />
        <CarteIndicateur
          libelle="Solde dû"
          valeur={fmtCompact(du)}
          unite="FCFA"
          ton={du > 0 ? "alerte" : "valide"}
        />
        <CarteIndicateur
          libelle="Délai moyen"
          valeur={delaiMoyen.toFixed(1).replace(".", ",")}
          unite="jours"
          precision="Sert au calcul du réapprovisionnement"
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Fournisseur</Th>
            <Th>Catégorie</Th>
            <Th>Téléphone</Th>
            <Th aligne="droite">Délai</Th>
            <Th aligne="droite">Achats</Th>
            <Th aligne="droite">Solde dû</Th>
          </tr>
        </thead>
        <tbody>
          {FOURNISSEURS.map((fournisseur) => (
            <tr key={fournisseur.id}>
              <Td chiffres>{fournisseur.code}</Td>
              <Td fort>
                {fournisseur.nom}
                {fournisseur.ncc && (
                  <span className="chiffres block text-xs font-normal text-[var(--encre-faible)]">
                    {fournisseur.ncc}
                  </span>
                )}
              </Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">
                  {fournisseur.categorie}
                </span>
              </Td>
              <Td chiffres>{fournisseur.telephone}</Td>
              <Td aligne="droite" chiffres>
                {fmtEntier(fournisseur.delaiJours)} j
              </Td>
              <Td aligne="droite" chiffres>
                {fmt(fournisseur.volumeAchats)}
              </Td>
              <Td aligne="droite" chiffres fort>
                <span className={fournisseur.soldeDu > 0 ? "text-alerte-600" : ""}>
                  {fmt(fournisseur.soldeDu)}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </>
  );
}
