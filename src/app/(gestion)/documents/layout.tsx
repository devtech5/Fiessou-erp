import { SousNavigation } from "@/components/coque/sous-navigation";

/**
 * Deux sections, et c'est délibéré.
 *
 * Ce module n'est pas un espace de stockage : c'est une pièce jointe
 * disponible partout, plus la signature. Tout ce qui ressemblerait à une suite
 * bureautique reconstruite — tableur, traitement de texte — est hors périmètre.
 */
const SECTIONS = [
  { href: "/documents", libelle: "Documents" },
  { href: "/documents/signatures", libelle: "Signatures" },
];

export default function LayoutDocuments({ children }: LayoutProps<"/documents">) {
  return (
    <>
      <SousNavigation entrees={SECTIONS} />
      {children}
    </>
  );
}
