import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";

const SECTIONS = [
  { href: "/membres", libelle: "Utilisateurs" },
  { href: "/membres/roles", libelle: "Rôles" },
  { href: "/membres/modules", libelle: "Modules" },
];

export default async function LayoutMembres({
  children,
}: LayoutProps<"/membres">) {
  if (!(await peut("organisation.membre.gerer"))) {
    return <AccesRefuse droit="organisation.membre.gerer" />;
  }

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
