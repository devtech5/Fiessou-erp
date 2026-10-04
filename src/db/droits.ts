import { DROITS, PRESETS_ROLES, type DefinitionDroit } from "@/lib/droits/catalogue";

/**
 * Recopie le catalogue des droits dans `permissions` et pose les rôles
 * préréglés manquants — l'équivalent de `pnpm db:droits`, appelable depuis le
 * serveur.
 *
 * Sert à la base locale PGlite, qu'aucun script extérieur ne peut ouvrir
 * pendant que le serveur la tient : la synchronisation se fait donc au
 * démarrage. Idempotente, comme le script.
 */
export type Executeur = (
  texte: string,
  valeurs?: unknown[],
) => Promise<{ rows: unknown[] }>;

export async function synchroniserDroits(executer: Executeur): Promise<void> {
  const catalogue: readonly DefinitionDroit[] = DROITS;

  for (const droit of catalogue) {
    await executer(
      `insert into permissions (key, module_key, label, description)
       values ($1, $2, $3, $4)
       on conflict (key) do update
         set module_key = excluded.module_key,
             label = excluded.label,
             description = excluded.description`,
      [droit.cle, droit.moduleKey, droit.libelle, droit.description ?? null],
    );
  }

  for (const preset of PRESETS_ROLES) {
    await executer(
      `insert into roles (organization_id, key, name, description, is_system)
       select id, $1, $2, $3, true from organizations
       on conflict (organization_id, key) do nothing`,
      [preset.cle, preset.nom, preset.description],
    );
  }
}
