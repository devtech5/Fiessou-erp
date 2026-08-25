import type { Metadata } from "next";

import { EnTetePage } from "@/components/ui/primitives";
import { BandeauFloat, Guichet } from "./guichet";

export const metadata: Metadata = { title: "Guichet" };

export default function PageGuichet() {
  return (
    <>
      <EnTetePage
        titre="Guichet"
        sousTitre="Transfert d'argent et vente de crédit"
      />
      <BandeauFloat />
      <Guichet />
    </>
  );
}
