import { env } from "@/env";

/**
 * Bandeau d'instance de démonstration.
 *
 * Se déclenche sur `INSTANCE_DEMO=1`. Il sert à la présentation : les chiffres
 * affichés sont des jeux d'essai. Un prospect qui les prend pour un vrai bilan
 * repart avec une idée fausse de ce qu'il a vu.
 */
export function BandeauDemo() {
  if (env.INSTANCE_DEMO !== "1") return null;

  return (
    <div className="flex shrink-0 items-center justify-center gap-2 bg-alerte-600 px-3 py-1 text-center text-[11px] font-medium text-white">
      Instance de démonstration — données fictives
    </div>
  );
}
