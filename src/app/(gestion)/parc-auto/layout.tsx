import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/parc-auto", libelle: "Véhicules" },
  { href: "/parc-auto/carburant", libelle: "Carburant" },
  { href: "/parc-auto/echeances", libelle: "Échéances" },
];

export default async function LayoutParcAuto({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("parc_auto")) return <ModuleEnPreparation cle="parc_auto" />;
  if (!(await peut("parc_auto.consulter"))) return <AccesRefuse droit="parc_auto.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
