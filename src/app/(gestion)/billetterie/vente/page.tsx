import type { Metadata } from "next";

import { EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { departVendable } from "@/modules/billetterie/calcul";
import { listerDeparts, siegesOccupes } from "@/modules/billetterie/requetes";

import { PlanPlaces } from "./plan-places";

export const metadata: Metadata = { title: "Vente de billets" };

export default async function PageVente() {
  const session = await exigerEntreprise();
  const debutJour = new Date();
  debutJour.setUTCHours(0, 0, 0, 0);

  const [departs, vendre] = await Promise.all([
    listerDeparts(session.organizationId, debutJour),
    peut("billetterie.billet.vendre"),
  ]);
  const vendables = departs.filter((d) => departVendable(d.statut));
  const occupes = await siegesOccupes(
    session.organizationId,
    vendables.map((d) => d.id),
  );

  return (
    <>
      <EnTetePage titre="Vente" sousTitre="Choix du départ et des places au plan" />
      {vendables.length === 0 ? (
        <EtatVide
          titre="Aucun départ en vente"
          message="Programmez un départ dans l'onglet Départs : ses sièges apparaîtront ici."
        />
      ) : (
        <PlanPlaces
          vendre={vendre}
          departs={vendables.map((d) => ({
            id: d.id,
            reference: d.reference,
            trajet: `${d.villeDepart} → ${d.villeArrivee}`,
            partLe: d.partLe.toISOString(),
            rangees: d.rangees,
            tarif: d.tarif,
            statut: d.statut,
            occupes: occupes[d.id] ?? [],
          }))}
        />
      )}
    </>
  );
}
