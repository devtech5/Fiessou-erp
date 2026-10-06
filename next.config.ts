import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serveur autonome pour l'image Docker du VPS : `.next/standalone` porte
  // server.js et les seuls node_modules réellement utilisés.
  output: "standalone",
  // PGlite charge un PostgreSQL compilé en WebAssembly depuis son propre
  // dossier : l'empaqueter casserait les chemins vers le .wasm et les données.
  // Les bibliothèques de messagerie (IMAP, MIME, SMTP) ouvrent des sockets
  // et chargent leurs encodages à l'exécution : elles restent dans node_modules.
  serverExternalPackages: ["@electric-sql/pglite", "imapflow", "mailparser", "nodemailer"],
  experimental: {
    serverActions: {
      // Une pièce jointe va jusqu'à 10 Mo (photo de chantier, reçu scanné) ;
      // le reste couvre l'enveloppe multipart.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
