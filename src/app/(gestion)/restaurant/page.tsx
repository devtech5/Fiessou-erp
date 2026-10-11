import type { Metadata } from "next";

import { PlanDeSalle } from "@/components/restauration/plan-de-salle";

export const metadata: Metadata = { title: "Restaurant" };

export default function PageRestaurant() {
  return <PlanDeSalle espace="restaurant" />;
}
