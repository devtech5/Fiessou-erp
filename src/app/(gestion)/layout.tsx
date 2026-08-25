import { NavigationModules } from "@/components/navigation";

/**
 * Coque des écrans de gestion.
 *
 * La caisse n'en fait pas partie : elle occupe tout l'écran, sans navigation
 * latérale. Un caissier n'a rien à chercher pendant un encaissement.
 */
export default function LayoutGestion({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <NavigationModules />
      <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
