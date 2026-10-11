import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";
import { lienRapports } from "@/lib/rapports/registre";

const SECTIONS = [{ href: "/boutique", libelle: "Aujourd'hui" }];

export default async function LayoutBoutique({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("boutique")) return <ModuleEnPreparation cle="boutique" />;
  if (!(await peut("boutique.consulter"))) return <AccesRefuse droit="boutique.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} rapports={await lienRapports("pos")} />
      {children}
    </>
  );
}
