import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { lienRapports } from "@/lib/rapports/registre";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/reservations", libelle: "Contrats" },
  { href: "/reservations/planning", libelle: "Planning" },
  { href: "/reservations/ressources", libelle: "Ressources" },
  { href: "/reservations/abonnements", libelle: "Abonnements" },
];

export default async function LayoutReservations({
  children,
}: LayoutProps<"/reservations">) {
  if (!moduleOuvert("reservation")) return <ModuleEnPreparation cle="reservation" />;

  if (!(await peut("reservation.consulter"))) return <AccesRefuse droit="reservation.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} rapports={await lienRapports("reservation")} />
      {children}
    </>
  );
}
