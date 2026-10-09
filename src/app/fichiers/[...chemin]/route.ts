import { env } from "@/env";
import { lireSigne } from "@/lib/stockage/local";

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

/**
 * Lecture d'un fichier du dépôt disque (développement, ou VPS avec volume).
 * L'URL est signée et expire : c'est elle qui autorise.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ chemin: string[] }> }) {
  if (!env.STOCKAGE_LOCAL) return new Response(null, { status: 404 });

  const { chemin } = await params;
  const url = new URL(requete.url);
  const cle = chemin.join("/");
  const contenu = await lireSigne(cle, Number(url.searchParams.get("exp")), url.searchParams.get("sig") ?? "");
  if (!contenu) return new Response("Lien expiré ou invalide.", { status: 403 });

  const extension = cle.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(contenu), {
    headers: {
      "Content-Type": TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
