import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";

const SECTIONS = [
  { href: "/monnaie", libelle: "Guichet" },
  { href: "/monnaie/operations", libelle: "Opérations" },
  { href: "/monnaie/cloture", libelle: "Clôture" },
];

export default async function LayoutMonnaie({
  children,
}: LayoutProps<"/monnaie">) {
  if (!(await peut("valeur_electronique.consulter"))) return <AccesRefuse droit="valeur_electronique.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
