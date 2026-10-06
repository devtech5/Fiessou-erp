import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/communication", libelle: "Envois" },
  { href: "/communication/campagnes", libelle: "Messages groupés" },
  { href: "/communication/desinscriptions", libelle: "Désinscriptions" },
];

export default async function LayoutCommunication({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("communication")) return <ModuleEnPreparation cle="communication" />;
  if (!(await peut("communication.consulter"))) return <AccesRefuse droit="communication.consulter" />;
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
