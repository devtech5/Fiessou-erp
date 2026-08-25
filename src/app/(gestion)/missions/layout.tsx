import { SousNavigation } from "@/components/navigation";

const SECTIONS = [
  { href: "/missions", libelle: "Missions" },
  { href: "/missions/suivi", libelle: "Suivi terrain" },
  { href: "/missions/formulaires", libelle: "Formulaires" },
];

export default function LayoutMissions({ children }: LayoutProps<"/missions">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
