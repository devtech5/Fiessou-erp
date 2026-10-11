import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/hotel", libelle: "Chambres du jour" },
  { href: "/hotel/sejours", libelle: "Séjours" },
  { href: "/hotel/registre", libelle: "Registre des voyageurs" },
  { href: "/hotel/chambres", libelle: "Chambres et tarifs" },
];

export default async function LayoutHotel({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("hotellerie")) return <ModuleEnPreparation cle="hotellerie" />;
  if (!(await peut("hotellerie.consulter"))) return <AccesRefuse droit="hotellerie.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
