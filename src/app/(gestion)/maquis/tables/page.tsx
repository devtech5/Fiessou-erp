import type { Metadata } from "next";

import { GestionSalle } from "@/components/restauration/gestion-salle";

export const metadata: Metadata = { title: "Tables et encaissement" };

export default function PageTablesMaquis() {
  return <GestionSalle espace="maquis" />;
}
