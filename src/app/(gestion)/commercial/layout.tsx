import { AccesRefuse } from "@/components/coque/acces-refuse";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";

/**
 * Trois sections, pas dix.
 *
 * « Ventes » regroupe devis, factures et avoirs : ce sont trois états d'un même
 * flux commercial, pas trois métiers. Le concurrent leur donne trois onglets
 * distincts, plus un pour les abonnements, un pour les prestations, un pour le
 * catalogue, un pour l'analyse et un pour les meilleures ventes.
 */
const SECTIONS = [
  { href: "/commercial", libelle: "Clients" },
  { href: "/commercial/ventes", libelle: "Ventes" },
  { href: "/commercial/fournisseurs", libelle: "Fournisseurs" },
];

export default async function LayoutCommercial({
  children,
}: LayoutProps<"/commercial">) {
  if (!(await peut("tiers.fiche.consulter"))) return <AccesRefuse droit="tiers.fiche.consulter" />;

  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
