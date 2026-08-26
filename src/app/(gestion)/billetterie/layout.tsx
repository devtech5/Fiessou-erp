import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

const SECTIONS = [
  { href: "/billetterie", libelle: "Départs" },
  { href: "/billetterie/vente", libelle: "Vente" },
  { href: "/billetterie/billets", libelle: "Billets" },
  { href: "/billetterie/lignes", libelle: "Lignes" },
];

export default async function LayoutBilletterie({
  children,
}: LayoutProps<"/billetterie">) {
  if (!moduleOuvert("billetterie")) return <ModuleEnPreparation cle="billetterie" />;

  if (!(await peut("billetterie.consulter"))) return <AccesRefuse droit="billetterie.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
