import type { Metadata } from "next";

import {
  Champ,
  CLASSE_CHAMP,
  EnTetePage,
  EtatVide,
  Pastille,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { FormulaireRepliable } from "@/components/ui/operations";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtEntier } from "@/lib/format";
import { creerLigne } from "@/modules/billetterie/actions";
import { formaterDuree } from "@/modules/billetterie/calcul";
import { listerLignes } from "@/modules/billetterie/requetes";

import { BasculeLigne } from "../outils";

export const metadata: Metadata = { title: "Lignes" };

/**
 * Trajets desservis et tarifs. Le tarif d'une ligne se recopie dans chaque
 * départ programmé : le changer ne touche ni les départs en vente ni les
 * billets émis.
 */
export default async function PageLignes() {
  const session = await exigerEntreprise();
  const [lignes, gerer] = await Promise.all([listerLignes(session.organizationId), peut("billetterie.depart.gerer")]);

  return (
    <>
      <EnTetePage
        titre="Lignes"
        sousTitre="Trajets desservis et tarifs"
        actions={
          gerer ? (
            <FormulaireRepliable libelle="Nouvelle ligne" titre="Nouvelle ligne" action={creerLigne}>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Champ libelle="Code">
                  <input name="code" required placeholder="ABJ-BKE" className={`${CLASSE_CHAMP} chiffres`} />
                </Champ>
                <Champ libelle="Départ">
                  <input name="depart" required placeholder="Abidjan" className={CLASSE_CHAMP} />
                </Champ>
                <Champ libelle="Arrivée">
                  <input name="arrivee" required placeholder="Bouaké" className={CLASSE_CHAMP} />
                </Champ>
                <Champ libelle="Durée (minutes)">
                  <input name="dureeMinutes" type="number" min={1} required placeholder="300" className={`${CLASSE_CHAMP} chiffres`} />
                </Champ>
                <Champ libelle="Distance (km)">
                  <input name="distanceKm" type="number" min={1} placeholder="350" className={`${CLASSE_CHAMP} chiffres`} />
                </Champ>
                <Champ libelle="Tarif TTC">
                  <input name="tarif" inputMode="numeric" required placeholder="6000" className={`${CLASSE_CHAMP} chiffres`} />
                </Champ>
              </div>
            </FormulaireRepliable>
          ) : undefined
        }
      />

      {lignes.length === 0 ? (
        <EtatVide titre="Aucune ligne" message="Une ligne est un trajet desservi : Abidjan → Bouaké, sa durée, son tarif." />
      ) : (
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
              {gerer && <Th aligne="droite"> </Th>}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.id} className={ligne.active ? undefined : "opacity-60"}>
                <Td chiffres>{ligne.code}</Td>
                <Td fort>
                  {ligne.depart} → {ligne.arrivee}
                  {!ligne.active && (
                    <span className="ml-2">
                      <Pastille ton="neutre">Suspendue</Pastille>
                    </span>
                  )}
                </Td>
                <Td aligne="droite" chiffres>
                  {ligne.distanceKm === null ? "—" : `${fmtEntier(ligne.distanceKm)} km`}
                </Td>
                <Td aligne="droite" chiffres>
                  {formaterDuree(ligne.dureeMinutes)}
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmt(ligne.tarif)}
                </Td>
                <Td aligne="droite" chiffres>
                  {/* Le prix au kilomètre révèle les incohérences de grille :
                      une ligne nettement au-dessus des autres se vend mal. */}
                  <span className="text-[var(--encre-faible)]">
                    {ligne.distanceKm ? fmt(Math.round(ligne.tarif / ligne.distanceKm)) : "—"}
                  </span>
                </Td>
                <Td aligne="droite" chiffres>
                  {fmtEntier(ligne.departs)}
                </Td>
                <Td aligne="droite" chiffres>
                  {ligne.recette > 0 ? fmt(ligne.recette) : "—"}
                </Td>
                {gerer && (
                  <Td aligne="droite">
                    <BasculeLigne id={ligne.id} active={ligne.active} />
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  );
}
