import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { lienRapports } from "@/lib/rapports/registre";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/marches", libelle: "Appels d'offres" },
  { href: "/marches/consultations", libelle: "Consultations" },
  { href: "/marches/conventions", libelle: "Conventions" },
];

export default async function LayoutMarches({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("marches")) return <ModuleEnPreparation cle="marches" />;
  if (!(await peut("marches.consulter"))) return <AccesRefuse droit="marches.consulter" />;
  return (
    <>
      <SousNavigation entrees={SECTIONS} rapports={await lienRapports("marches")} />
      {children}
    </>
  );
}
