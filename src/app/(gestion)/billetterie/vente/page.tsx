import type { Metadata } from "next";

import { EnTetePage } from "@/components/ui/primitives";
import { PlanPlaces } from "./plan-places";

export const metadata: Metadata = { title: "Vente de billets" };

export default function PageVente() {
  return (
    <>
      <EnTetePage
        titre="Vente"
        sousTitre="Choix du départ et des places au plan"
      />
      <PlanPlaces />
    </>
  );
}
