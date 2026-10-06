import type { ReactNode } from "react";

import { BandeauAbonnement } from "@/components/coque/bandeau-abonnement";
import { BandeauDemo } from "@/components/coque/bandeau-demo";
import { VerrouInactivite } from "@/components/coque/verrou-inactivite";
import { exigerSession } from "@/lib/auth/dal";

/**
 * Coque de l'écran d'accueil : plein écran, sans barre latérale ni fil
 * d'Ariane — un lanceur, pas un écran de travail. Les modules s'ouvrent
 * depuis la grille ; on y revient par « Accueil » dans la barre latérale.
 *
 * Restent ce qui protège ou prévient : le verrouillage après inactivité et
 * les bandeaux d'abonnement et de démonstration.
 */
export default async function LayoutLanceur({ children }: { children: ReactNode }) {
  const session = await exigerSession();
  return (
    <>
      <div
        id="coque-lanceur"
        className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top_left,color-mix(in_srgb,var(--color-marque-500)_10%,var(--fond))_0%,var(--fond)_45%,var(--surface-creuse)_100%)]"
      >
        <BandeauDemo />
        <BandeauAbonnement />
        {children}
      </div>
      <VerrouInactivite
        cible="coque-lanceur"
        delaiMinutes={session.delaiVerrouillage}
        nom={session.nom}
        email={session.email}
        entreprise={session.organizationNom}
      />
    </>
  );
}
