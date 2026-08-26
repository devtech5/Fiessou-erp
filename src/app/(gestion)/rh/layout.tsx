import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";

/**
 * Le module s'appelle « Personnel », pas « RH & Paie » : il couvre deux
 * régimes de rémunération, et le second ne relève pas de la paie.
 *
 *   · Salariés     — contrat, bulletin, CNPS, ITS
 *   · Intervenants — pointage, taux, bon de paiement
 */
const SECTIONS = [
  { href: "/rh", libelle: "Salariés" },
  { href: "/rh/intervenants", libelle: "Intervenants" },
  { href: "/rh/paie", libelle: "Paie" },
];

export default async function LayoutRh({
  children,
}: LayoutProps<"/rh">) {
  if (!(await peut("personnes.consulter"))) return <AccesRefuse droit="personnes.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
