import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/securite", libelle: "Mur d'images" },
  { href: "/securite/sites", libelle: "Sites et caméras" },
];

export default async function LayoutSecurite({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("securite")) return <ModuleEnPreparation cle="securite" />;
  if (!(await peut("securite.consulter"))) return <AccesRefuse droit="securite.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
