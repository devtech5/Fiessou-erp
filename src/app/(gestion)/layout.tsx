import { BandeauDemo } from "@/components/coque/bandeau-demo";
import { BarreLaterale } from "@/components/coque/barre-laterale";
import { FilAriane } from "@/components/coque/fil-ariane";
import type { OptionSelecteur } from "@/components/coque/selecteur";
import { exigerSession } from "@/lib/auth/dal";
import { entreprisesAccessibles } from "@/lib/auth/entreprises";
import { droitsActifs } from "@/lib/droits/garde";

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

  // Sans entreprise active il n'y a pas de rôle, donc aucun droit : la barre
  // s'affiche vide plutôt que de rediriger, le sélecteur d'entreprise reste
  // atteignable.
  const droits = session.organizationId ? [...(await droitsActifs())] : [];

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
    /**
     * La coque occupe exactement la hauteur de la fenêtre et ne défile pas :
     * `h-dvh` plutôt que `min-h-dvh`, et le débordement est coupé ici. Le seul
     * élément qui défile est le contenu, plus bas.
     *
     * C'est ce qui garde la barre latérale et le fil d'Ariane à l'écran en
     * permanence. Avec une page qui défile d'un bloc, ils disparaissaient dès
     * le premier écran de liste — et sur un catalogue de quatre cents articles,
     * changer de module obligeait à remonter tout le tableau.
     *
     * `dvh` et non `vh` : sur un téléphone, la barre d'adresse se rétracte au
     * défilement et `vh` laisse alors une bande morte en bas de l'écran.
     */
    <div className="flex h-dvh flex-col overflow-hidden">
      <BandeauDemo />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <BarreLaterale
          nomUtilisateur={session.nom}
          entrepriseActive={session.organizationNom}
          droits={droits}
        />

        {/*
          `min-h-0` ici aussi, et pas seulement sur le contenu. Sur téléphone
          la coque s'empile en colonne : sans lui, cette colonne refuse de
          descendre sous la hauteur de son contenu, le contenu ne déborde donc
          jamais, et tout ce qui dépasse l'écran se fait couper par le
          `overflow-hidden` du dessus — inatteignable, sans barre de défilement
          pour le signaler.
        */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-3 border-b border-[var(--filet)] bg-[var(--surface)] px-3 py-1.5">
            <FilAriane
              entreprises={options}
              entrepriseActive={active}
              exercice={active ? exerciceCourant : null}
              exercices={[exerciceCourant]}
            />
          </header>

          {/*
            Le contenu est le conteneur de défilement. `min-h-0` est
            indispensable : un enfant de flexbox refuse par défaut de devenir
            plus petit que son contenu, et sans lui `overflow-y-auto` n'a rien
            à faire déborder — la page recommencerait à défiler d'un bloc.
          */}
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
