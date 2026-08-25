import { SousNavigation } from "@/components/navigation";

const SECTIONS = [
  { href: "/reservations", libelle: "Contrats" },
  { href: "/reservations/planning", libelle: "Planning" },
  { href: "/reservations/ressources", libelle: "Ressources" },
  { href: "/reservations/abonnements", libelle: "Abonnements" },
];

export default function LayoutReservations({
  children,
}: LayoutProps<"/reservations">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
