import type { Metadata } from "next";

import {
  BoutonPrincipal,
  EnTetePage,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { fmt, fmtEntier } from "@/lib/format";
import { DEPARTS, LIGNES, formaterDuree, recette } from "@/lib/fixtures/billetterie";

export const metadata: Metadata = { title: "Lignes" };

export default function PageLignes() {
  return (
    <>
      <EnTetePage
        titre="Lignes"
        sousTitre="Trajets desservis et tarifs"
        actions={<BoutonPrincipal>Nouvelle ligne</BoutonPrincipal>}
      />

      <Tableau>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Trajet</Th>
            <Th aligne="droite">Distance</Th>
            <Th aligne="droite">Durée</Th>
            <Th aligne="droite">Tarif</Th>
            <Th aligne="droite">Prix au km</Th>
            <Th aligne="droite">Départs</Th>
            <Th aligne="droite">Recette</Th>
          </tr>
        </thead>
        <tbody>
          {LIGNES.map((ligne) => {
            const departs = DEPARTS.filter((d) => d.ligne.id === ligne.id);
            const produit = departs.reduce((s, d) => s + recette(d), 0);

            return (
              <tr key={ligne.id}>
                <Td chiffres>{ligne.code}</Td>
                <Td fort>
                  {ligne.depart} → {ligne.arrivee}
                </Td>
                <Td aligne="droite" chiffres>
                  {fmtEntier(ligne.distanceKm)} km
                </Td>
                <Td aligne="droite" chiffres>
                  {formaterDuree(ligne.duree)}
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmt(ligne.tarif)}
                </Td>
                <Td aligne="droite" chiffres>
                  {/* Le prix au kilomètre révèle les incohérences de grille :
                      une ligne nettement au-dessus des autres se vend mal. */}
                  <span className="text-[var(--encre-faible)]">
                    {fmt(Math.round(ligne.tarif / ligne.distanceKm))}
                  </span>
                </Td>
                <Td aligne="droite" chiffres>
                  {fmtEntier(departs.length)}
                </Td>
                <Td aligne="droite" chiffres>
                  {produit > 0 ? fmt(produit) : "—"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Tableau>

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Les recettes portent sur les départs programmés des 25 et 26 août 2026.
      </p>
    </>
  );
}
