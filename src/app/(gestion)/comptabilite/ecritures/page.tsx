import type { Metadata } from "next";

import { EnTetePage } from "@/components/ui/primitives";
import { SaisieEcriture } from "./saisie";

export const metadata: Metadata = { title: "Écritures" };

export default function PageEcritures() {
  return (
    <>
      <EnTetePage
        titre="Écritures"
        sousTitre="Saisie guidée, partie double automatique"
      />
      <SaisieEcriture />
    </>
  );
}
