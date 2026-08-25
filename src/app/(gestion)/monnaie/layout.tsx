import { SousNavigation } from "@/components/coque/sous-navigation";

const SECTIONS = [
  { href: "/monnaie", libelle: "Guichet" },
  { href: "/monnaie/operations", libelle: "Opérations" },
  { href: "/monnaie/cloture", libelle: "Clôture" },
];

export default function LayoutMonnaie({ children }: LayoutProps<"/monnaie">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
