import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Fiessou",
    template: "%s · Fiessou",
  },
  description:
    "ERP et point de vente pour l'Afrique de l'Ouest. Encaisse sans connexion.",
};

export const viewport: Viewport = {
  // La caisse tourne sur tablette : le zoom accidentel pendant l'encaissement
  // déplace les touches sous les doigts du caissier.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0E5E6B",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
