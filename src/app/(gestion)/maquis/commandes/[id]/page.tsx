import type { Metadata } from "next";

import { PageCommande } from "@/components/restauration/page-commande";

export const metadata: Metadata = { title: "Commande" };

export default async function PageCommandeMaquis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageCommande espace="maquis" id={id} />;
}
