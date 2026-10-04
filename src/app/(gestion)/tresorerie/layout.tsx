import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

/**
 * Cinq sections. Qui ne fait que demander des bons de caisse ne voit que la
 * caisse : les soldes, les virements et la banque ne le regardent pas.
 */
export default async function LayoutTresorerie({ children }: LayoutProps<"/tresorerie">) {
  if (!moduleOuvert("tresorerie")) return <ModuleEnPreparation cle="tresorerie" />;

  const [consulter, demander, rapprocher] = await Promise.all([
    peut("tresorerie.consulter"),
    peut("tresorerie.bon.demander"),
    peut("tresorerie.rapprocher"),
  ]);
  if (!consulter && !demander) return <AccesRefuse droit="tresorerie.consulter" />;

  const sections = consulter
    ? [
        { href: "/tresorerie", libelle: "Comptes" },
        { href: "/tresorerie/virements", libelle: "Virements" },
        { href: "/tresorerie/caisse", libelle: "Caisse de dépenses" },
        ...(rapprocher ? [{ href: "/tresorerie/rapprochement", libelle: "Rapprochement" }] : []),
        { href: "/tresorerie/previsions", libelle: "Prévisions" },
      ]
    : [];

  return (
    <>
      {sections.length > 0 && <SousNavigation entrees={sections} />}
      {children}
    </>
  );
}
