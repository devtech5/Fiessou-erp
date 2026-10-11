import type { Metadata } from "next";

import { PlanDeSalle } from "@/components/restauration/plan-de-salle";

export const metadata: Metadata = { title: "Maquis" };

export default function PageMaquis() {
  return <PlanDeSalle espace="maquis" />;
}
