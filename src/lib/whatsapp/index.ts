import "server-only";

import { env } from "@/env";

/**
 * Envoi WhatsApp par l'API Cloud de Meta — une interface, comme
 * `src/lib/courriel`. `fetch` suffit, sans SDK.
 *
 * Deux formes :
 *   · un MODÈLE approuvé (`WHATSAPP_MODELE`), seul accepté pour écrire en
 *     premier à quelqu'un — relance, campagne, notification ;
 *   · un texte libre, accepté seulement dans les 24 heures qui suivent un
 *     message du destinataire. Meta le refuse sinon, et le refus remonte.
 */

export type ResultatWhatsApp = { ok: true; idMessage: string | null } | { ok: false; raison: string };

export function whatsappConfigure(): boolean {
  return Boolean(env.WHATSAPP_JETON && env.WHATSAPP_NUMERO_ID);
}

const VERSION_API = "v21.0";

export async function envoyerWhatsApp(numero: string, texte: string): Promise<ResultatWhatsApp> {
  if (!whatsappConfigure()) {
    if (env.NODE_ENV !== "production") {
      console.info(JSON.stringify({ evenement: "whatsapp_non_envoye", a: numero, texte }));
    }
    return { ok: false, raison: "WhatsApp Business n'est pas configuré sur cette instance." };
  }

  // Meta veut le numéro au format international, chiffres seuls : 2250700000000.
  const destinataire = numero.replace(/\D/g, "");
  const corps = env.WHATSAPP_MODELE
    ? {
        messaging_product: "whatsapp",
        to: destinataire,
        type: "template",
        template: {
          name: env.WHATSAPP_MODELE,
          language: { code: env.WHATSAPP_LANGUE },
          // Un paramètre de modèle ne tolère ni saut de ligne ni tabulation.
          components: [{ type: "body", parameters: [{ type: "text", text: texte.replace(/\s+/g, " ").slice(0, 1000) }] }],
        },
      }
    : { messaging_product: "whatsapp", to: destinataire, type: "text", text: { body: texte.slice(0, 4096) } };

  try {
    const reponse = await fetch(`https://graph.facebook.com/${VERSION_API}/${env.WHATSAPP_NUMERO_ID}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.WHATSAPP_JETON}`, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });
    const donnees = (await reponse.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string; code?: number } } | null;
    if (!reponse.ok) {
      console.error(JSON.stringify({ evenement: "whatsapp_refuse", statut: reponse.status, code: donnees?.error?.code }));
      // Le code 131047 : hors de la fenêtre de 24 h, sans modèle.
      const raison =
        donnees?.error?.code === 131047
          ? "Hors de la fenêtre de 24 h : un modèle WhatsApp approuvé est nécessaire (WHATSAPP_MODELE)."
          : `WhatsApp a refusé l'envoi (${reponse.status}).`;
      return { ok: false, raison };
    }
    return { ok: true, idMessage: donnees?.messages?.[0]?.id ?? null };
  } catch (erreur) {
    console.error(JSON.stringify({ evenement: "whatsapp_echec", message: erreur instanceof Error ? erreur.message : String(erreur) }));
    return { ok: false, raison: "WhatsApp est injoignable." };
  }
}
