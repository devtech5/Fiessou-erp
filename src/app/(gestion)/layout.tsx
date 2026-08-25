import { NavigationModules } from "@/components/navigation";
import { seDeconnecter } from "@/lib/auth/actions";
import { exigerSession } from "@/lib/auth/dal";

/**
 * Coque des écrans de gestion.
 *
 * La caisse n'en fait pas partie : elle occupe tout l'écran, sans navigation
 * latérale. Un caissier n'a rien à chercher pendant un encaissement.
 *
 * La session est exigée ici, et pas seulement dans `proxy.ts` : ce dernier ne
 * regarde que la présence d'un cookie, qui peut porter un jeton révoqué ou
 * inventé. C'est cet appel qui interroge réellement la base.
 */
export default async function LayoutGestion({ children }: LayoutProps<"/">) {
  const session = await exigerSession();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <NavigationModules />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-[var(--filet)] bg-[var(--surface)] px-4 py-2">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium">{session.nom}</p>
            <p className="truncate text-xs text-[var(--encre-faible)]">
              {session.organizationNom ?? "Aucune entreprise"}
            </p>
          </div>

          <form action={seDeconnecter}>
            <button
              type="submit"
              className="h-cible rounded-lg border border-[var(--filet)] px-3 text-sm font-medium hover:bg-[var(--surface-creuse)]"
            >
              Quitter
            </button>
          </form>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
