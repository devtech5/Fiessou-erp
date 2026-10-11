import type { Metadata } from "next";

import { EcranProduction } from "@/components/restauration/ecran-production";

export const metadata: Metadata = { title: "Cuisine et bar" };

export default async function PageProductionRestaurant({ searchParams }: { searchParams: Promise<{ poste?: string }> }) {
  const { poste } = await searchParams;
  return <EcranProduction espace="restaurant" filtre={poste} />;
}
