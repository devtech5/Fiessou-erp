"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { marquerNotificationsLues } from "@/modules/communication/actions";

export function ToutMarquerLu() {
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          await marquerNotificationsLues();
          routeur.refresh();
        })
      }
      className="h-cible rounded-lg border border-[var(--filet)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)] disabled:opacity-50"
    >
      Tout marquer comme lu
    </button>
  );
}
