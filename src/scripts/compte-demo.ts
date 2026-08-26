/**
 * Crée le compte de démonstration.
 *
 *   pnpm demo:compte
 *
 * Le but est d'éviter de dérouler une inscription devant un public : le numéro
 * est connu d'avance, la connexion mène directement au tableau de bord.
 *
 * Le script est idempotent — le relancer ne duplique rien et ne casse rien.
 * Il n'écrit aucun code de connexion : ceux-ci restent générés à la demande,
 * et `OTP_CHANNEL=demo` les affiche à l'écran.
 *
 * SQL brut plutôt que Drizzle, comme `verifier-base.ts` : `tsx` ne résout pas
 * les alias de chemins du tsconfig, et un script d'exploitation n'a pas à
 * dépendre de la couche applicative.
 */
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

import { PRESETS_ROLES } from "../lib/droits/catalogue";

loadEnv({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL absent. Renseignez .env.local.");
  process.exit(1);
}

/** Numéro de démonstration. Dix chiffres, format ivoirien depuis 2021. */
const TELEPHONE = "+2250700000000";
const NOM = "Compte de démonstration";
const ENTREPRISE = "Quincaillerie Akwaba";

async function main() {
  const sql = postgres(url!, { max: 1, connect_timeout: 15 });

  try {
    const [utilisateur] = await sql`
      insert into users (phone, full_name, phone_verified_at)
      values (${TELEPHONE}, ${NOM}, now())
      on conflict (phone) do update set full_name = excluded.full_name
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

    Numéro    ${TELEPHONE}
    Entreprise ${ENTREPRISE}

  Sur l'écran de connexion, saisissez 07 00 00 00 00 : le code
  s'affiche à l'écran si OTP_CHANNEL=demo.
`);
  } finally {
    await sql.end();
  }
}

main().catch((erreur) => {
  console.error("Création du compte de démonstration en échec.", erreur);
  process.exit(1);
});
