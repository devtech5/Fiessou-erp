import { redirect } from "next/navigation";

/**
 * Ancienne adresse du bulletin imprimable. Le bulletin s'affiche désormais
 * dans l'application (`/rh/paie/bulletins/[id]`), d'où il s'imprime seul ;
 * cette route ne sert plus qu'aux liens déjà enregistrés.
 */
export default async function AncienneImpressionBulletin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/rh/paie/bulletins/${encodeURIComponent(id)}`);
}
