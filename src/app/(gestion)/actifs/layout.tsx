import { SousNavigation } from "@/components/navigation";

const SECTIONS = [
  { href: "/actifs", libelle: "Parc" },
  { href: "/actifs/interventions", libelle: "Interventions" },
  { href: "/actifs/echeances", libelle: "Échéances" },
];

export default function LayoutActifs({ children }: LayoutProps<"/actifs">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
