import { exigerEntreprise } from "@/lib/auth/dal";
import { droitsActifs } from "@/lib/droits/garde";
import { rapport } from "@/lib/rapports/registre";
import { lirePeriode, versCsv } from "@/lib/rapports/types";

/**
 * Export d'un rapport pour Excel. Mêmes contrôles que la page : la session, le
 * droit d'ouvrir les rapports, et celui du module concerné.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params;
  const definition = rapport(cle);
  if (!definition) return new Response("Rapport inconnu.", { status: 404 });

  const session = await exigerEntreprise();
  const droits = await droitsActifs();
  if (!droits.has("rapports.consulter") || !droits.has(definition.droit)) return new Response("Accès refusé.", { status: 403 });

  const url = new URL(requete.url);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const periode = lirePeriode({ du: url.searchParams.get("du") ?? undefined, au: url.searchParams.get("au") ?? undefined }, aujourdhui);
  if (definition.periode === "situation") periode.du = periode.au;

  let corps: string;
  try {
    corps = versCsv(await definition.executer(session.organizationId, periode));
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (!message || message.startsWith("Failed query")) console.error(`Export ${cle}`, e);
    return new Response(message && !message.startsWith("Failed query") ? message : "Le rapport n'a pas pu être calculé.", { status: 422 });
  }

  const nom = definition.periode === "situation" ? `${cle}_${periode.au}` : `${cle}_${periode.du}_${periode.au}`;
  return new Response(corps, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
