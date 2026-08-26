import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";

const SECTIONS = [
  { href: "/billetterie", libelle: "Départs" },
  { href: "/billetterie/vente", libelle: "Vente" },
  { href: "/billetterie/billets", libelle: "Billets" },
  { href: "/billetterie/lignes", libelle: "Lignes" },
];

export default async function LayoutBilletterie({
  children,
}: LayoutProps<"/billetterie">) {
  if (!(await peut("billetterie.consulter"))) return <AccesRefuse droit="billetterie.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
