import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";

const SECTIONS = [
  { href: "/actifs", libelle: "Parc" },
  { href: "/actifs/interventions", libelle: "Interventions" },
  { href: "/actifs/echeances", libelle: "Échéances" },
];

export default async function LayoutActifs({ children }: LayoutProps<"/actifs">) {
  if (!(await peut("actifs.consulter"))) return <AccesRefuse droit="actifs.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
