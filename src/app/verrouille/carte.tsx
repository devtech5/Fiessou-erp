"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { CarteVerrou } from "@/components/coque/verrou-inactivite";

export function CarteVerrouPage(props: {
  nom: string;
  email: string | null;
  entreprise: string | null;
  delaiMinutes: number;
}) {
  const router = useRouter();
  const reprendre = useCallback(() => {
    try {
      localStorage.setItem("fiessou-verrou", "0");
      localStorage.setItem("fiessou-activite", String(Date.now()));
    } catch {
      // Stockage indisponible : les autres onglets se déverrouilleront seuls au rechargement.
    }
    router.replace("/");
    router.refresh();
  }, [router]);

  return <CarteVerrou {...props} onDeverrouille={reprendre} />;
}
