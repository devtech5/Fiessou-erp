import { SousNavigation } from "@/components/navigation";

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

export default function LayoutRh({ children }: LayoutProps<"/rh">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
