import { redirect } from "next/navigation";

/**
 * Ancienne adresse de la note de chambre. Elle s'affiche désormais dans
 * l'application (`/hotel/sejours/[id]/note`), d'où elle s'imprime seule.
 */
export default async function AncienneNoteChambre({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/hotel/sejours/${encodeURIComponent(id)}/note`);
}
