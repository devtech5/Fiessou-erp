import type { Metadata } from "next";

import { CAISSIERS, CATALOGUE } from "@/lib/fixtures/catalogue";
import { EcranCaisse } from "./ecran-caisse";

export const metadata: Metadata = {
  title: "Caisse",
};

export default function PageCaisse() {
  // Provisoire : ces données viendront du dépôt rattaché à la caisse une fois
  // le module Catalogue & Stock en place.
  return (
    <EcranCaisse
      articles={CATALOGUE}
      caissier={CAISSIERS[0]}
      nomCaisse="Caisse 1"
      nomBoutique="Supérette Akwaba"
    />
  );
}
