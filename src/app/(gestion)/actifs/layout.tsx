import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { lienRapports } from "@/lib/rapports/registre";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/actifs", libelle: "Parc" },
  { href: "/actifs/interventions", libelle: "Interventions" },
  { href: "/actifs/echeances", libelle: "Échéances" },
];

export default async function LayoutActifs({ children }: LayoutProps<"/actifs">) {
  if (!moduleOuvert("actifs")) return <ModuleEnPreparation cle="actifs" />;

  if (!(await peut("actifs.consulter"))) return <AccesRefuse droit="actifs.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} rapports={await lienRapports("actifs")} />
      {children}
    </>
  );
}
