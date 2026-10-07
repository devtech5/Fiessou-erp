import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";
import { lienRapports } from "@/lib/rapports/registre";

/**
 * Cinq sections. Qui ne fait que demander des bons de caisse ne voit que la
 * caisse : les soldes, les virements et la banque ne le regardent pas.
 *
 * Les virements internes et le rapprochement bancaire sont des gestes sur un
 * compte : ils s'ouvrent depuis Mouvements et depuis la fiche du compte, pas
 * depuis deux onglets de plus.
 */
export default async function LayoutTresorerie({ children }: LayoutProps<"/tresorerie">) {
  if (!moduleOuvert("tresorerie")) return <ModuleEnPreparation cle="tresorerie" />;

  const [consulter, demander] = await Promise.all([peut("tresorerie.consulter"), peut("tresorerie.bon.demander")]);
  if (!consulter && !demander) return <AccesRefuse droit="tresorerie.consulter" />;

  const sections = consulter
    ? [
        { href: "/tresorerie", libelle: "Comptes" },
        { href: "/tresorerie/mouvements", libelle: "Mouvements" },
        { href: "/tresorerie/caisse", libelle: "Caisse de dépenses" },
        { href: "/tresorerie/charges", libelle: "Charges" },
        { href: "/tresorerie/previsions", libelle: "Prévisions" },
      ]
    : [];

  return (
    <>
      {sections.length > 0 && <SousNavigation entrees={sections} rapports={await lienRapports("tresorerie")} />}
      {children}
    </>
  );
}
