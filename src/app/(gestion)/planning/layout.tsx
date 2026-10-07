import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { lienRapports } from "@/lib/rapports/registre";
import { moduleOuvert } from "@/lib/modules/garde";

export default async function LayoutPlanning({ children }: LayoutProps<"/planning">) {
  if (!moduleOuvert("planning")) return <ModuleEnPreparation cle="planning" />;
  if (!(await peut("planning.utiliser"))) return <AccesRefuse droit="planning.utiliser" />;

  const sections = [
    { href: "/planning", libelle: "Mon planning" },
    ...((await peut("planning.equipe.consulter")) ? [{ href: "/planning/equipe", libelle: "Équipe" }] : []),
    { href: "/planning/horaires", libelle: "Horaires habituels" },
  ];

  return (
    <>
      <SousNavigation entrees={sections} rapports={await lienRapports("planning")} />
      {children}
    </>
  );
}
