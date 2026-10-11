import type { Metadata } from "next";

import { EcranProduction } from "@/components/restauration/ecran-production";

export const metadata: Metadata = { title: "Grill et bar" };

export default async function PageProductionMaquis({ searchParams }: { searchParams: Promise<{ poste?: string }> }) {
  const { poste } = await searchParams;
  return <EcranProduction espace="maquis" filtre={poste} />;
}
