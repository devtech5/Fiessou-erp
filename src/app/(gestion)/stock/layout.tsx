import { SousNavigation } from "@/components/coque/sous-navigation";

const SECTIONS = [
  { href: "/stock", libelle: "Vue d'ensemble" },
  { href: "/stock/articles", libelle: "Articles" },
  { href: "/stock/mouvements", libelle: "Mouvements" },
  { href: "/stock/reapprovisionnement", libelle: "Réapprovisionnement" },
];

export default function LayoutStock({ children }: LayoutProps<"/stock">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
