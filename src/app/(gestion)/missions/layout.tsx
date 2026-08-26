import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/missions", libelle: "Missions" },
  { href: "/missions/suivi", libelle: "Suivi terrain" },
  { href: "/missions/formulaires", libelle: "Formulaires" },
];

export default async function LayoutMissions({
  children,
}: LayoutProps<"/missions">) {
  if (!moduleOuvert("missions")) return <ModuleEnPreparation cle="missions" />;

  if (!(await peut("missions.consulter"))) return <AccesRefuse droit="missions.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
