import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { session } from "@/lib/auth/dal";
import { CONNEXION_EXPIREE } from "@/lib/auth/session";
import { EcranVerrouillagePage } from "./carte";

export const metadata: Metadata = { title: "Écran verrouillé" };

/**
 * Où retombe une session verrouillée : rechargement de page, nouvel onglet,
 * ordinateur rouvert après la pause. Aucune donnée d'entreprise n'y est lue.
 */
export default async function PageVerrouille() {
  const active = await session();
  if (!active) redirect(CONNEXION_EXPIREE);
  if (!active.verrouillee) redirect("/");

  return (
    <main>
      <EcranVerrouillagePage nom={active.nom} email={active.email} entreprise={active.organizationNom} />
    </main>
  );
}
