import { SousNavigation } from "@/components/navigation";

const SECTIONS = [
  { href: "/billetterie", libelle: "Départs" },
  { href: "/billetterie/vente", libelle: "Vente" },
  { href: "/billetterie/billets", libelle: "Billets" },
  { href: "/billetterie/lignes", libelle: "Lignes" },
];

export default function LayoutBilletterie({
  children,
}: LayoutProps<"/billetterie">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
