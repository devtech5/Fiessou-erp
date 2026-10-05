import Link from "next/link";

import { abonnementCourant } from "@/lib/abonnement/garde";

const TON = {
  info: "bg-marque-600 text-white",
  attention: "bg-alerte-500 text-white",
  critique: "bg-danger-600 text-white",
} as const;

/**
 * Bandeau d'abonnement : essai en cours, échéance proche, grâce, lecture
 * seule. Rien quand tout va bien — un bandeau permanent finit par ne plus
 * être lu, y compris le jour où il compte.
 */
export async function BandeauAbonnement() {
  const etat = await abonnementCourant();
  if (!etat?.message || !etat.gravite) return null;

  return (
    <div className={`flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-3 py-1 text-center text-xs font-medium ${TON[etat.gravite]}`}>
      <span>{etat.message}</span>
      <Link href="/abonnement" className="font-semibold underline underline-offset-2">
        {etat.phase === "essai" ? "Voir les formules" : "Renouveler"}
      </Link>
    </div>
  );
}
