import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { lienRapports } from "@/lib/rapports/registre";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/parc-informatique", libelle: "Équipements" },
  { href: "/parc-informatique/licences", libelle: "Licences" },
];

export default async function LayoutParcInformatique({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("parc_informatique")) return <ModuleEnPreparation cle="parc_informatique" />;
  if (!(await peut("parc_informatique.consulter"))) return <AccesRefuse droit="parc_informatique.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} rapports={await lienRapports("parc_informatique")} />
      {children}
    </>
  );
}
