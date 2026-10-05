import "server-only";

import { env } from "@/env";

/**
 * Envoi d'e-mails : une interface, un adaptateur derrière — comme
 * `src/lib/stockage`. Le reste de l'application ne connaît que `envoyerCourriel`.
 *
 * Brevo et Resend passent par leur API HTTP, sans SDK : `fetch` suffit, et la
 * dépendance en moins est une mise à jour de sécurité en moins à suivre.
 */

export interface Courriel {
  a: string;
  sujet: string;
  texte: string;
  html?: string;
}

export type ResultatEnvoi = { ok: true } | { ok: false; raison: string };

/** Vrai quand un fournisseur est branché. Faux : le contenu part au journal. */
export function courrielConfigure(): boolean {
  return Boolean(env.COURRIEL_FOURNISSEUR && env.COURRIEL_CLE);
}

/** « Nom <adresse> » ou « adresse » seule. */
export function lireExpediteur(valeur: string): { nom?: string; adresse: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(valeur);
  return m ? { nom: m[1] || undefined, adresse: m[2].trim() } : { adresse: valeur.trim() };
}

export async function envoyerCourriel(c: Courriel): Promise<ResultatEnvoi> {
  if (!courrielConfigure()) {
    // Développement : le message est lisible dans le journal, rien ne part.
    // Jamais en production : un lien de réinitialisation dans le journal
    // donnerait à quiconque le lit l'entrée dans n'importe quel compte.
    const texte = env.NODE_ENV === "production" ? undefined : c.texte;
    console.info(JSON.stringify({ evenement: "courriel_non_envoye", a: c.a, sujet: c.sujet, texte }));
    return { ok: false, raison: "Aucun fournisseur d'e-mails configuré." };
  }

  const expediteur = lireExpediteur(env.COURRIEL_EXPEDITEUR);
  try {
    const reponse =
      env.COURRIEL_FOURNISSEUR === "brevo"
        ? await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": env.COURRIEL_CLE!, "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
              sender: { name: expediteur.nom, email: expediteur.adresse },
              to: [{ email: c.a }],
              subject: c.sujet,
              textContent: c.texte,
              htmlContent: c.html,
            }),
          })
        : await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { authorization: `Bearer ${env.COURRIEL_CLE}`, "content-type": "application/json" },
            body: JSON.stringify({ from: env.COURRIEL_EXPEDITEUR, to: [c.a], subject: c.sujet, text: c.texte, html: c.html }),
          });
    if (!reponse.ok) {
      // Le corps peut citer la clé ou le compte : on n'en garde que le statut.
      console.error(JSON.stringify({ evenement: "courriel_refuse", fournisseur: env.COURRIEL_FOURNISSEUR, statut: reponse.status }));
      return { ok: false, raison: `Le fournisseur d'e-mails a refusé l'envoi (${reponse.status}).` };
    }
    return { ok: true };
  } catch (erreur) {
    console.error(JSON.stringify({ evenement: "courriel_echec", message: erreur instanceof Error ? erreur.message : String(erreur) }));
    return { ok: false, raison: "Le fournisseur d'e-mails est injoignable." };
  }
}
