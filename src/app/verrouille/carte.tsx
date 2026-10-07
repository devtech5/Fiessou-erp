"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { EcranVerrouillage } from "@/components/coque/ecran-verrouillage";
import { marquerDeverrouille } from "@/components/coque/verrou-inactivite";

export function EcranVerrouillagePage(props: { nom: string; email: string | null; entreprise: string | null }) {
  const router = useRouter();
  const reprendre = useCallback(() => {
    marquerDeverrouille();
    router.replace("/");
    router.refresh();
  }, [router]);

  return <EcranVerrouillage {...props} onDeverrouille={reprendre} />;
}
