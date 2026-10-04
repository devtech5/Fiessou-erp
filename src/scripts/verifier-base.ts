/**
 * Contrôle l'état de la base après migration.
 *
 *   pnpm db:check
 *
 * Vérifie trois choses, dans cet ordre d'importance :
 *   1. la connexion aboutit ;
 *   2. les tables attendues existent — socle et modules livrés ;
 *   3. la sécurité au niveau ligne est active sur chacune.
 *
 * Le troisième point n'est pas cosmétique : sur Supabase, une table du schéma
 * `public` sans RLS est lisible par quiconque détient la clé publiable, qui est
 * publique par conception.
 */
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL absent. Renseignez .env.local.");
  process.exit(1);
}

const TABLES_ATTENDUES = [
  "abonnements",
  "actifs",
  "articles",
  "audit_logs",
  "bons_paiement",
  "change_log",
  "comptages_caisse",
  "contrats_location",
  "demandes_signature",
  "depots",
  "document_sequences",
  "documents",
  "echeances",
  "ecritures",
  "employees",
  "entity_codes",
  "etapes_mission",
  "familles_article",
  "formulaires",
  "interventions",
  "lignes_ecriture",
  "lignes_piece",
  "lignes_vente",
  "memberships",
  "missions",
  "mouvements_stock",
  "organization_modules",
  "organizations",
  "permissions",
  "pieces_commerciales",
  "pointages",
  "preuves_mission",
  "passages_abonnement",
  "postes_caisse",
  "reglements_piece",
  "reglements_vente",
  "releves_compteur",
  "reponses_formulaire",
  "ressources",
  "role_permissions",
  "roles",
  "sessions",
  "sessions_caisse",
  "signataires",
  "sync_cursors",
  "sync_mutations",
  "tiers",
  "users",
  "ventes",
  "verification_codes",
  "workers",
];

const sql = postgres(url, { max: 1, prepare: false });

// Enveloppé dans une fonction : tsx compile ce script en CommonJS, qui n'admet
// pas d'`await` au niveau racine.
async function main() {
  const debut = Date.now();
  await sql`select 1`;
  console.log(`Connexion établie en ${Date.now() - debut} ms.`);

  const lignes = await sql<{ tablename: string; rowsecurity: boolean }[]>`
    select tablename, rowsecurity
    from pg_tables
    where schemaname = 'public'
    order by tablename
  `;

  const presentes = new Set(lignes.map((l) => l.tablename));
  const manquantes = TABLES_ATTENDUES.filter((t) => !presentes.has(t));
  const sansRls = lignes.filter(
    (l) => TABLES_ATTENDUES.includes(l.tablename) && !l.rowsecurity,
  );

  console.log(
    `\nTables attendues : ${TABLES_ATTENDUES.length - manquantes.length} / ${TABLES_ATTENDUES.length}`,
  );

  if (manquantes.length > 0) {
    console.error(`Manquantes : ${manquantes.join(", ")}`);
    console.error("Lancez `pnpm db:migrate`.");
    process.exit(1);
  }

  if (sansRls.length > 0) {
    console.error(
      `\nRLS INACTIF sur ${sansRls.length} table(s) : ${sansRls
        .map((l) => l.tablename)
        .join(", ")}`,
    );
    console.error(
      "Ces tables sont lisibles avec la clé publiable. Appliquez la migration 0001.",
    );
    process.exit(1);
  }

  console.log(`RLS actif sur les ${TABLES_ATTENDUES.length} tables.`);

  // Les tables hors liste sont signalées sans faire échouer : ce sont soit des
  // tables métier à venir, soit des tables propres à l'hébergeur.
  const autres = lignes.filter((l) => !TABLES_ATTENDUES.includes(l.tablename));
  if (autres.length > 0) {
    const risquees = autres.filter((l) => !l.rowsecurity).map((l) => l.tablename);
    console.log(`\nAutres tables du schéma public : ${autres.length}`);
    if (risquees.length > 0) {
      console.warn(`Sans RLS : ${risquees.join(", ")}`);
    }
  }

  console.log("\nBase conforme.");
}

main()
  .catch((erreur) => {
    console.error("\nÉchec de la vérification :");
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
