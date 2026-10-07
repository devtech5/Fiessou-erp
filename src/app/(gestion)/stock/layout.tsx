import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { lienRapports } from "@/lib/rapports/registre";
import { peut } from "@/lib/droits/garde";

const SECTIONS = [
  { href: "/stock", libelle: "Vue d'ensemble" },
  { href: "/stock/articles", libelle: "Articles" },
  { href: "/stock/modeles", libelle: "Modèles à variantes" },
  { href: "/stock/mouvements", libelle: "Mouvements" },
  { href: "/stock/reapprovisionnement", libelle: "Réapprovisionnement" },
];

export default async function LayoutStock({
  children,
}: LayoutProps<"/stock">) {
  if (!(await peut("stock.article.consulter"))) return <AccesRefuse droit="stock.article.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} rapports={await lienRapports("stock")} />
      {children}
    </>
  );
}
