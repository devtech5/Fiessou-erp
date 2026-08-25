import type { Metadata } from "next";

import { EnTetePage } from "@/components/ui/primitives";
import { Rapprochement } from "./rapprochement";

export const metadata: Metadata = { title: "Clôture du guichet" };

export default function PageCloture() {
  return (
    <>
      <EnTetePage
        titre="Clôture du guichet"
        sousTitre="Rapprochement des espèces et du float"
      />
      <Rapprochement />
    </>
  );
}
