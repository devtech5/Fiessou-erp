import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { session } from "@/lib/auth/dal";
import { CarteVerrouPage } from "./carte";

export const metadata: Metadata = { title: "Écran verrouillé" };

/**
 * Où retombe une session verrouillée : rechargement de page, nouvel onglet,
 * ordinateur rouvert après la pause. Aucune donnée d'entreprise n'y est lue.
 */
export default async function PageVerrouille() {
  const active = await session();
  if (!active) redirect("/connexion");
  if (!active.verrouillee) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fond)] p-4">
      <CarteVerrouPage
        nom={active.nom}
        email={active.email}
        entreprise={active.organizationNom}
        delaiMinutes={active.delaiVerrouillage}
      />
    </main>
  );
}
