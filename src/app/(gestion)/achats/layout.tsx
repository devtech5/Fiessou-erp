import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { lienRapports } from "@/lib/rapports/registre";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/achats", libelle: "Commandes" },
  { href: "/achats/factures", libelle: "Factures fournisseurs" },
  { href: "/achats/dettes", libelle: "Dettes et règlements" },
];

export default async function LayoutAchats({ children }: LayoutProps<"/achats">) {
  if (!moduleOuvert("achats")) return <ModuleEnPreparation cle="achats" />;
  if (!(await peut("achats.consulter"))) return <AccesRefuse droit="achats.consulter" />;
  return (
    <>
      <SousNavigation entrees={SECTIONS} rapports={await lienRapports("achats")} />
      {children}
    </>
  );
}
