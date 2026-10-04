import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite charge un PostgreSQL compilé en WebAssembly depuis son propre
  // dossier : l'empaqueter casserait les chemins vers le .wasm et les données.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      // Une pièce jointe va jusqu'à 10 Mo (photo de chantier, reçu scanné) ;
      // le reste couvre l'enveloppe multipart.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
