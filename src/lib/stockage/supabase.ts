import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/env";

import type { FichierADeposer, ResultatDepot } from "./index";

/**
 * Adaptateur Supabase Storage.
 *
 * Seul fichier du projet à connaître le SDK de l'hébergeur. Tout le reste
 * passe par `src/lib/stockage/index.ts`.
 *
 * La clé employée est la clé `service_role` : elle CONTOURNE RLS sur
 * l'ensemble du projet. Elle ne doit jamais atteindre le navigateur — d'où
 * `server-only`, l'absence de préfixe `NEXT_PUBLIC_`, et le fait que ce module
 * ne soit importé que par du code serveur.
 */

let client: SupabaseClient | null = null;

/**
 * Client mis en cache, comme le pool PostgreSQL.
 *
 * En développement, Next recharge les modules à chaque modification : sans ce
 * cache, chaque rechargement construirait un client de plus.
 */
function stockage(): SupabaseClient {
  if (client) return client;

  client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    // Aucune session à tenir : ce client sert une requête serveur et s'arrête.
    // Laisser le rafraîchissement automatique actif ouvrirait un minuteur qui
    // ne s'éteint jamais dans un processus de longue durée.
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

export async function deposerSupabase(
  fichier: FichierADeposer,
): Promise<ResultatDepot> {
  const { error } = await stockage()
    .storage.from(env.SUPABASE_BUCKET)
    .upload(fichier.chemin, fichier.contenu, {
      contentType: fichier.typeMime,
      // Pas d'écrasement : le chemin porte l'identifiant du document, donc une
      // collision signale un bug, pas un remplacement voulu.
      upsert: false,
    });

  if (error) {
    return { ok: false, raison: `Dépôt refusé : ${error.message}` };
  }

  return { ok: true, chemin: fichier.chemin };
}

export async function urlSigneeSupabase(
  chemin: string,
  secondes: number,
): Promise<string | null> {
  const { data, error } = await stockage()
    .storage.from(env.SUPABASE_BUCKET)
    .createSignedUrl(chemin, secondes);

  if (error || !data) return null;
  return data.signedUrl;
}

export async function supprimerSupabase(chemin: string): Promise<boolean> {
  const { error } = await stockage()
    .storage.from(env.SUPABASE_BUCKET)
    .remove([chemin]);

  return !error;
}
