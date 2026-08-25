import type { Metadata } from "next";

import { EnTetePage } from "@/components/ui/primitives";
import { FilMission } from "./fil-mission";

export const metadata: Metadata = { title: "Suivi terrain" };

export default function PageSuivi() {
  return (
    <>
      <EnTetePage
        titre="Suivi terrain"
        sousTitre="Étapes et preuves rapportées du terrain"
      />
      <FilMission />
    </>
  );
}
