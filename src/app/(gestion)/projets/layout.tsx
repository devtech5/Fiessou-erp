import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/projets", libelle: "Projets" },
  { href: "/projets/depenses", libelle: "Dépenses" },
];

export default async function LayoutProjets({ children }: LayoutProps<"/projets">) {
  if (!moduleOuvert("projet")) return <ModuleEnPreparation cle="projet" />;

  if (!(await peut("projet.consulter"))) return <AccesRefuse droit="projet.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
