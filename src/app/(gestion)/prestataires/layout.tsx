import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/prestataires", libelle: "Annuaire" },
  { href: "/prestataires/prestations", libelle: "Prestations" },
];

export default async function LayoutPrestataires({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("prestataires")) return <ModuleEnPreparation cle="prestataires" />;
  if (!(await peut("prestataires.consulter"))) return <AccesRefuse droit="prestataires.consulter" />;
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
