import { BarreLaterale } from "@/components/coque/barre-laterale";
import { FilAriane } from "@/components/coque/fil-ariane";
import type { OptionSelecteur } from "@/components/coque/selecteur";
import { exigerSession } from "@/lib/auth/dal";
import { entreprisesAccessibles } from "@/lib/auth/entreprises";

const ETIQUETTE_STATUT: Record<string, string> = {
  essai: "essai",
  actif: "actif",
  suspendu: "suspendu",
  resilie: "résilié",
};

/**
 * Coque des écrans de gestion.
 *
 * Disposition reprise des tableaux de bord Vercel et Supabase : fil d'Ariane à
 * sélecteurs en haut, barre latérale groupée à gauche, menu de compte en pied
 * de barre. Le contexte de travail — entreprise, exercice — reste lisible en
 * permanence et se change sur place, sans page dédiée.
 *
 * La caisse n'en fait pas partie : elle occupe tout l'écran, sans navigation.
 * Un caissier n'a rien à chercher pendant un encaissement.
 *
 * La session est exigée ici et pas seulement dans `proxy.ts` : ce dernier ne
 * regarde que la présence d'un cookie, qui peut porter un jeton révoqué.
 */
export default async function LayoutGestion({ children }: LayoutProps<"/">) {
  const session = await exigerSession();
  const entreprises = await entreprisesAccessibles(session.userId);

  const options: OptionSelecteur[] = entreprises.map((entreprise) => ({
    id: entreprise.id,
    libelle: entreprise.nom,
    badge: ETIQUETTE_STATUT[entreprise.statut] ?? entreprise.statut,
    detail: `${entreprise.roleNom} · ${entreprise.pays}`,
  }));

  const active = options.find((o) => o.id === session.organizationId) ?? null;

  // L'exercice reste figé tant que le module comptable ne gère pas la clôture :
  // proposer d'en changer avant de savoir le faire serait un leurre.
  const exerciceCourant: OptionSelecteur = {
    id: "2026",
    libelle: "Exercice 2026",
    badge: "ouvert",
    detail: "Du 01/01/2026 au 31/12/2026",
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <BarreLaterale
        nomUtilisateur={session.nom}
        entrepriseActive={session.organizationNom}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--filet)] bg-[var(--surface)] px-3 py-1.5">
          <FilAriane
            entreprises={options}
            entrepriseActive={active}
            exercice={active ? exerciceCourant : null}
            exercices={[exerciceCourant]}
          />
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
