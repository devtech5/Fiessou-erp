import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";

/**
 * Quatre sections — la caisse de dépenses est partie en Trésorerie. Le concurrent en aligne vingt-sept, sur quatre lignes.
 *
 * Ce qui a été absorbé plutôt qu'ajouté : le grand livre, la balance et les
 * journaux sont des vues du même écran d'écritures, pas trois onglets ; le
 * lettrage et le rapprochement se font depuis le compte concerné ; les
 * clôtures mensuelle et annuelle sont deux états d'un même assistant.
 */
const SECTIONS = [
  { href: "/comptabilite", libelle: "Vue d'ensemble" },
  { href: "/comptabilite/ecritures", libelle: "Écritures" },
  { href: "/comptabilite/etats", libelle: "États financiers" },
  { href: "/comptabilite/fiscalite", libelle: "Fiscalité" },
];

export default async function LayoutComptabilite({
  children,
}: LayoutProps<"/comptabilite">) {
  if (!(await peut("comptabilite.ecriture.consulter"))) return <AccesRefuse droit="comptabilite.ecriture.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
