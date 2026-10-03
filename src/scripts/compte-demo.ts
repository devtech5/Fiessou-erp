/**
 * Crée le compte de démonstration.
 *
 *   pnpm demo:compte
 *
 * Le but est d'éviter de dérouler une inscription devant un public :
 * l'adresse est connue d'avance, la connexion mène directement au tableau de
 * bord.
 *
 * Le mot de passe vient de `DEMO_MOT_DE_PASSE` s'il est fourni ; sinon il est
 * tiré au hasard et affiché UNE fois dans ce terminal. Relancer le script le
 * remplace : c'est aussi la façon de le retrouver.
 *
 * Le script est idempotent — le relancer ne duplique rien. Un compte de
 * démonstration créé du temps de la connexion par téléphone est repris et
 * reçoit l'adresse ci-dessous.
 *
 * SQL brut plutôt que Drizzle, comme `verifier-base.ts` : `tsx` ne résout pas
 * les alias de chemins du tsconfig, et un script d'exploitation n'a pas à
 * dépendre de la couche applicative.
 */
import { randomInt } from "node:crypto";

import { hash } from "@node-rs/argon2";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

import { PRESETS_ROLES } from "../lib/droits/catalogue";

loadEnv({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL absent. Renseignez .env.local.");
  process.exit(1);
}

/** Adresse de démonstration. */
const EMAIL = "demo@fiessou.ci";
/** Numéro de l'ancien compte de démonstration, repris s'il existe. */
const ANCIEN_TELEPHONE = "+2250700000000";
const NOM = "Compte de démonstration";
const ENTREPRISE = "Quincaillerie Akwaba";

async function main() {
  const sql = postgres(url!, { max: 1, connect_timeout: 15 });

  try {
    const motDePasse =
      process.env.DEMO_MOT_DE_PASSE ??
      Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[randomInt(0, 31)]).join(""),
      ).join("-");
    const empreinte = await hash(motDePasse);

    // L'ancien compte (connexion par téléphone) reçoit l'adresse, s'il n'y a
    // pas déjà un compte qui la porte.
    await sql`
      update users set email = ${EMAIL}
      where phone = ${ANCIEN_TELEPHONE} and email is null
        and not exists (select 1 from users where email = ${EMAIL})
    `;

    const [utilisateur] = await sql`
      insert into users (email, full_name, password_hash, must_change_password)
      values (${EMAIL}, ${NOM}, ${empreinte}, false)
      on conflict (email) do update set
        full_name = excluded.full_name,
        password_hash = excluded.password_hash,
        must_change_password = false,
        failed_logins = 0,
        locked_until = null
      returning id
    `;

    const slug = `demo-${utilisateur.id.slice(0, 8)}`;

    const [entreprise] = await sql`
      insert into organizations (name, slug, country_code, status)
      values (${ENTREPRISE}, ${slug}, 'CI', 'actif')
      on conflict (slug) do update set name = excluded.name
      returning id
    `;

    // L'entreprise de démonstration reçoit les mêmes rôles qu'une vraie : la
    // démonstration sert aussi à montrer qu'un caissier ne voit pas la
    // comptabilité.
    for (const preset of PRESETS_ROLES) {
      await sql`
        insert into roles (organization_id, key, name, description, is_system)
        values (${entreprise.id}, ${preset.cle}, ${preset.nom}, ${preset.description}, true)
        on conflict (organization_id, key) do nothing
      `;
    }

    const [role] = await sql<{ id: string }[]>`
      select id from roles
      where organization_id = ${entreprise.id} and key = 'proprietaire'
    `;

    await sql`
      insert into memberships (organization_id, user_id, role_id, status, is_owner, joined_at)
      values (${entreprise.id}, ${utilisateur.id}, ${role.id}, 'actif', true, now())
      on conflict (organization_id, user_id) do update set status = 'actif'
    `;

    console.info(`
  Compte de démonstration prêt.

    Adresse       ${EMAIL}
    Mot de passe  ${motDePasse}
    Entreprise    ${ENTREPRISE}

  Le mot de passe n'est affiché qu'ici. Relancer le script en tire un autre.
`);
  } finally {
    await sql.end();
  }
}

main().catch((erreur) => {
  console.error("Création du compte de démonstration en échec.", erreur);
  process.exit(1);
});
