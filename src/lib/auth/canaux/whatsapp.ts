import "server-only";

import { env } from "@/env";

/**
 * Acheminement des codes par WhatsApp Cloud API.
 *
 * WhatsApp plutôt que le SMS en canal principal, pour ce marché : le
 * commerçant ivoirien y est déjà, le message d'authentification y coûte une
 * fraction d'un SMS, et il arrive même sur une ligne en itinérance.
 *
 * Un code ne part PAS en message libre. Hors d'une fenêtre de conversation
 * ouverte par le client, Meta n'accepte qu'un gabarit approuvé — et un gabarit
 * de catégorie « authentification », dont le texte est imposé. C'est aussi ce
 * qui donne le bouton « copier » et le remplissage automatique du clavier.
 */

export interface ConfigWhatsApp {
  version: string;
  phoneId: string;
  template: string;
  langue: string;
}

/**
 * Construit le corps de la requête.
 *
 * Séparé de l'envoi pour être testable : la forme de cette charge utile est la
 * seule chose qui casse en silence, et il n'existe aucun moyen de l'éprouver
 * sans un compte Meta vérifié.
 *
 * Le code apparaît DEUX fois, et ce n'est pas une redondance : la première
 * remplit la variable du texte, la seconde alimente le bouton de copie. Meta
 * les traite comme deux composants distincts, et n'en fournir qu'un fait
 * échouer l'envoi avec une erreur qui ne nomme pas le composant manquant.
 *
 * Le bouton se déclare `sub_type: "url"` même lorsqu'il copie le code. C'est
 * la forme documentée pour les gabarits d'authentification, contre-intuitive
 * au point qu'on la corrige par réflexe — d'où ce commentaire.
 */
export function corpsMessage(
  destination: string,
  code: string,
  config: ConfigWhatsApp,
): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: destination,
    type: "template",
    template: {
      name: config.template,
      language: { code: config.langue },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: code }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  };
}

/** L'adresse d'envoi, dérivée de la version et du numéro expéditeur. */
export function adresseEnvoi(config: ConfigWhatsApp): string {
  return `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`;
}

/**
 * Envoie le code. Rend une raison lisible en cas d'échec, jamais le code.
 *
 * Un délai est imposé : sans lui, une API qui ne répond pas laisse le caissier
 * devant un formulaire figé, et il finit par recharger la page — ce qui
 * demande un second code et brûle le premier.
 */
export async function envoyerWhatsApp(
  destination: string,
  code: string,
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const token = env.WHATSAPP_TOKEN;
  const phoneId = env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    return { ok: false, raison: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID manquant" };
  }

  const config: ConfigWhatsApp = {
    version: env.WHATSAPP_VERSION,
    phoneId,
    template: env.WHATSAPP_TEMPLATE,
    langue: env.WHATSAPP_LANGUE,
  };

  try {
    const reponse = await fetch(adresseEnvoi(config), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(corpsMessage(destination, code, config)),
      signal: AbortSignal.timeout(10_000),
    });

    if (reponse.ok) return { ok: true };

    // Le corps de la réponse d'erreur de Meta nomme précisément la cause —
    // gabarit non approuvé, jeton expiré, numéro hors liste de test. Le lire
    // évite une demi-journée à deviner. Il ne contient pas le code.
    const detail = await reponse.text().catch(() => "");
    return {
      ok: false,
      raison: `HTTP ${reponse.status} — ${detail.slice(0, 300)}`,
    };
  } catch (erreur) {
    return {
      ok: false,
      raison: erreur instanceof Error ? erreur.message : String(erreur),
    };
  }
}
