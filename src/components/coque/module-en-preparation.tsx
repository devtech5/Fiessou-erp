import Link from "next/link";

import { getModule } from "@/modules/registry";

/**
 * Écran affiché à la place d'un module dont les données seraient fictives.
 *
 * Distinct d'`AccesRefuse`, et la distinction n'est pas cosmétique : là, le
 * rôle est en cause et le gérant peut corriger ; ici, rien n'est à corriger,
 * le module n'est pas encore branché. Servir le même écran dans les deux cas
 * enverrait l'utilisateur réclamer un droit qui ne lui ouvrirait rien.
 *
 * On annonce ce que le module fera plutôt que de rendre un 404. Un prospect
 * qui lit le périmètre à venir apprend quelque chose ; une page introuvable
 * lui apprend que le logiciel est troué.
 */
export function ModuleEnPreparation({ cle }: { cle: string }) {
  const definition = getModule(cle);

  return (
    <div className="mx-auto max-w-[60ch] rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-6 text-center">
      <h1 className="text-lg font-semibold">
        {definition?.name ?? "Module"} — en préparation
      </h1>

      <p className="mt-3 text-sm text-[var(--encre-douce)]">
        {definition?.description ??
          "Cette partie du logiciel n'est pas encore ouverte."}
      </p>

      <p className="mt-2 text-sm text-[var(--encre-douce)]">
        Elle n&apos;est pas ouverte sur cette instance : tant qu&apos;un module
        ne lit pas vos données, il ne vous en montre aucune.
      </p>

      <Link
        href="/"
        className="h-cible mt-5 inline-flex items-center rounded-lg bg-marque-600 px-4 text-sm font-semibold leading-[var(--h-cible)] text-white hover:bg-marque-700"
      >
        Revenir au tableau de bord
      </Link>
    </div>
  );
}
