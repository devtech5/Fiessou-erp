import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite charge un PostgreSQL compilé en WebAssembly depuis son propre
  // dossier : l'empaqueter casserait les chemins vers le .wasm et les données.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
