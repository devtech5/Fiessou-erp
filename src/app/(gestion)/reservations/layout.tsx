import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";

const SECTIONS = [
  { href: "/reservations", libelle: "Contrats" },
  { href: "/reservations/planning", libelle: "Planning" },
  { href: "/reservations/ressources", libelle: "Ressources" },
  { href: "/reservations/abonnements", libelle: "Abonnements" },
];

export default async function LayoutReservations({
  children,
}: LayoutProps<"/reservations">) {
  if (!(await peut("reservation.consulter"))) return <AccesRefuse droit="reservation.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
