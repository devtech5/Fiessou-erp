import { SousNavigation } from "@/components/coque/sous-navigation";

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

export default function LayoutCommercial({ children }: LayoutProps<"/commercial">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
