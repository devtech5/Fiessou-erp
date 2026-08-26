import "server-only";

import { env } from "@/env";
import { envoyerWhatsApp } from "./whatsapp";

/**
 * Acheminement d'un code de vérification.
 *
 * Un seul point de dispatch, parce qu'un code qui part par deux chemins
 * différents selon l'appelant est un code qu'on ne sait plus tracer.
 *
 * `codeAffiche` n'est renseigné que dans les modes où le code est RENDU à
 * l'appelant au lieu d'être envoyé. C'est la seule différence entre un mode de
 * développement et un canal réel, et elle est explicite plutôt que devinée.
 */
export type ResultatAcheminement =
  | { ok: true; codeAffiche?: string }
  | { ok: false; raison: string };

export async function acheminer(
  destination: string,
  code: string,
): Promise<ResultatAcheminement> {
  switch (env.OTP_CHANNEL) {
    case "console":
      console.info(`\n  Code de connexion pour ${destination} : ${code}\n`);
      return { ok: true };

    // Mode démonstration : le code revient à l'écran. Rien n'est envoyé, donc
    // rien à recevoir — quiconque atteint l'instance peut entrer avec
    // n'importe quel numéro. C'est le prix d'une démo sans opérateur, et la
    // raison pour laquelle ce mode ne doit jamais côtoyer de vraies données.
    case "demo":
      return { ok: true, codeAffiche: code };

    case "whatsapp":
      return envoyerWhatsApp(destination, code);

    case "sms":
      // Pas encore d'agrégateur retenu. Un refus net vaut mieux qu'un envoi
      // silencieusement perdu : l'écran dira que le code n'est pas parti, et
      // le journal dira pourquoi.
      return {
        ok: false,
        raison: "Canal SMS non branché : aucun agrégateur n'est configuré.",
      };
  }
}
