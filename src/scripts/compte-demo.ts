/**
 * Crée le compte de démonstration.
 *
 *   pnpm demo:compte
 *
 * Le but est d'éviter de dérouler une inscription devant un public :
 * l'adresse est connue d'avance, la connexion mène directement au tableau de
 * bord.
 *
 * Deux comptes, dans la même entreprise :
 *   · le propriétaire (`demo@fiessou.ci`), qui voit tout ;
 *   · le gérant (`gerant@fiessou.ci`), rôle préréglé `gerant` — de quoi montrer
 *     ce que voit un responsable d'exploitation, et ce qu'il ne voit pas.
 *
 * Les mots de passe viennent de `DEMO_MOT_DE_PASSE` et
 * `DEMO_MOT_DE_PASSE_GERANT` s'ils sont fournis ; sinon ils sont tirés au
 * hasard et affichés UNE fois dans ce terminal. Relancer le script les
 * remplace : c'est aussi la façon de les retrouver.
 *
 * Le script est idempotent — le relancer ne duplique rien. Un compte de
 * démonstration créé du temps de la connexion par téléphone est repris et
 * reçoit l'adresse ci-dessous.
 *
 * SQL brut plutôt que Drizzle, comme `verifier-base.ts` : `tsx` ne résout pas
 * les alias de chemins du tsconfig, et un script d'exploitation n'a pas à
 * dépendre de la couche applicative.
 *
 * En production, l'image Docker l'embarque, empaqueté par esbuild
 * (`pnpm build:scripts`). Depuis le terminal du conteneur (Dokploy) :
 *
 *   node scripts/compte-demo.cjs
 *
 * Il prend DATABASE_URL dans l'environnement du conteneur.
 *
 * Sur la base locale PGlite : `pnpm demo:compte:local`, serveur ARRÊTÉ (un
 * seul processus ouvre le dossier). Les identifiants sont alors aussi écrits
 * dans `.pglite/identifiants-demo.txt`, à côté de la base qu'ils ouvrent.
 */
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { hash } from "@node-rs/argon2";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

import { PRESETS_ROLES } from "../lib/droits/catalogue";

loadEnv({ path: ".env.local", quiet: true });

// La base locale PGlite prime : `demo:compte:local` ne doit jamais écrire sur
// la base distante de DATABASE_URL_MIGRATION.
const url = process.env.DATABASE_URL?.startsWith("pglite:")
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL_MIGRATION || process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL absent. Renseignez .env.local.");
  process.exit(1);
}

/** Adresse de démonstration. */
const EMAIL = "demo@fiessou.ci";
const EMAIL_GERANT = "gerant@fiessou.ci";
const NOM_GERANT = "Gérant de démonstration";
/** Numéro de l'ancien compte de démonstration, repris s'il existe. */
const ANCIEN_TELEPHONE = "+2250700000000";
const NOM = "Compte de démonstration";
const ENTREPRISE = "Quincaillerie Akwaba";

type Ligne = Record<string, string>;

/** Une requête paramétrée, quel que soit le moteur derrière. */
interface Base {
  requete(texte: string, valeurs?: unknown[]): Promise<Ligne[]>;
  fermer(): Promise<void>;
}

async function ouvrir(chaine: string): Promise<Base & { dossierPglite?: string }> {
  if (chaine.startsWith("pglite:")) {
    const dossier = resolve(chaine.slice("pglite:".length) || "./.pglite");
    mkdirSync(dossier, { recursive: true });
    // Import différé : l'image de production n'embarque pas PGlite, et le
    // script y tourne sur PostgreSQL.
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(dossier);
    await client.waitReady;
    // Les tables viennent des migrations, appliquées au démarrage du serveur.
    const [{ existe }] = (
      await client.query<{ existe: boolean }>("select to_regclass('public.users') is not null as existe")
    ).rows;
    if (!existe) {
      await client.close();
      throw new Error("Base PGlite vide : lancer `pnpm dev:local` une fois pour appliquer les migrations.");
    }
    return {
      dossierPglite: dossier,
      requete: async (texte, valeurs) => (await client.query<Ligne>(texte, valeurs)).rows,
      fermer: () => client.close(),
    };
  }

  const sql = postgres(chaine, { max: 1, connect_timeout: 15 });
  return {
    requete: (texte, valeurs) => sql.unsafe<Ligne[]>(texte, (valeurs ?? []) as never[]),
    fermer: () => sql.end(),
  };
}

/** Quatre groupes de quatre caractères, sans les signes qu'on confond (0/o, 1/l/i). */
function motDePasseAuHasard(): string {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[randomInt(0, 31)]).join(""),
  ).join("-");
}

/**
 * Crée le compte, ou le remet en état : mot de passe remplacé, verrou levé,
 * aucun changement de mot de passe exigé à la connexion.
 */
async function compte(base: Base, email: string, nom: string, motDePasse: string): Promise<string> {
  const [utilisateur] = await base.requete(
    `insert into users (email, full_name, password_hash, must_change_password)
    values ($1, $2, $3, false)
    on conflict (email) do update set
      full_name = excluded.full_name,
      password_hash = excluded.password_hash,
      must_change_password = false,
      failed_logins = 0,
      locked_until = null
    returning id`,
    [email, nom, await hash(motDePasse)],
  );
  return utilisateur.id;
}

async function main() {
  const base = await ouvrir(url!);

  try {
    const motDePasse = process.env.DEMO_MOT_DE_PASSE ?? motDePasseAuHasard();
    const motDePasseGerant = process.env.DEMO_MOT_DE_PASSE_GERANT ?? motDePasseAuHasard();

    // L'ancien compte (connexion par téléphone) reçoit l'adresse, s'il n'y a
    // pas déjà un compte qui la porte.
    await base.requete(
      `update users set email = $1
       where phone = $2 and email is null
         and not exists (select 1 from users where email = $1)`,
      [EMAIL, ANCIEN_TELEPHONE],
    );

    const proprietaireId = await compte(base, EMAIL, NOM, motDePasse);
    const gerantId = await compte(base, EMAIL_GERANT, NOM_GERANT, motDePasseGerant);

    const slug = `demo-${proprietaireId.slice(0, 8)}`;

    const [entreprise] = await base.requete(
      `insert into organizations (name, slug, country_code, status)
      values ($1, $2, 'CI', 'actif')
      on conflict (slug) do update set name = excluded.name
      returning id`,
      [ENTREPRISE, slug],
    );

    // L'entreprise de démonstration reçoit les mêmes rôles qu'une vraie : la
    // démonstration sert aussi à montrer qu'un caissier ne voit pas la
    // comptabilité.
    for (const preset of PRESETS_ROLES) {
      await base.requete(
        `insert into roles (organization_id, key, name, description, is_system)
        values ($1, $2, $3, $4, true)
        on conflict (organization_id, key) do nothing`,
        [entreprise.id, preset.cle, preset.nom, preset.description],
      );
    }

    const roleDe = async (cle: string): Promise<string> => {
      const [role] = await base.requete(
        `select id from roles where organization_id = $1 and key = $2`,
        [entreprise.id, cle],
      );
      return role.id;
    };

    await base.requete(
      `insert into memberships (organization_id, user_id, role_id, status, is_owner, joined_at)
      values ($1, $2, $3, 'actif', true, now())
      on conflict (organization_id, user_id) do update set status = 'actif'`,
      [entreprise.id, proprietaireId, await roleDe("proprietaire")],
    );

    // Le gérant reprend son rôle à chaque passage : un essai fait pendant une
    // démonstration ne doit pas fausser la suivante.
    await base.requete(
      `insert into memberships (organization_id, user_id, role_id, status, is_owner, joined_at)
      values ($1, $2, $3, 'actif', false, now())
      on conflict (organization_id, user_id) do update set
        role_id = excluded.role_id,
        status = 'actif',
        is_owner = false`,
      [entreprise.id, gerantId, await roleDe("gerant")],
    );

    const identifiants = `Propriétaire  ${EMAIL}
              ${motDePasse}
Gérant        ${EMAIL_GERANT}
              ${motDePasseGerant}
Entreprise    ${ENTREPRISE}
`;

    if (base.dossierPglite) {
      writeFileSync(join(base.dossierPglite, "identifiants-demo.txt"), identifiants);
    }

    console.info(`
  Comptes de démonstration prêts.

${identifiants.replace(/^(?=.)/gm, "    ")}
  Les mots de passe ne sont affichés qu'ici. Relancer le script en tire d'autres.
`);
  } finally {
    await base.fermer();
  }
}

main().catch((erreur) => {
  console.error("Création du compte de démonstration en échec.", erreur);
  process.exit(1);
});
