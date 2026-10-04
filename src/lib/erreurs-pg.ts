/**
 * Code SQLSTATE d'une erreur PostgreSQL, où qu'il se trouve.
 *
 * Drizzle enveloppe l'erreur du pilote dans une `DrizzleQueryError` qui porte
 * la requête, et range l'erreur d'origine dans `cause`. Lire `erreur.code`
 * directement ne trouve donc rien : une violation d'unicité remontait en page
 * d'erreur au lieu du message prévu (« ce code est déjà utilisé »). On descend
 * la chaîne des causes jusqu'au code.
 */
export function codePostgres(erreur: unknown): string | null {
  let courante: unknown = erreur;

  for (let profondeur = 0; profondeur < 5 && courante; profondeur += 1) {
    if (typeof courante === "object" && "code" in courante) {
      const code = (courante as { code: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    }
    courante =
      typeof courante === "object" && "cause" in courante
        ? (courante as { cause: unknown }).cause
        : null;
  }

  return null;
}

/** Violation d'unicité : la ligne existe déjà. */
export const estDoublon = (erreur: unknown) => codePostgres(erreur) === "23505";

/** Violation de clé étrangère : une ligne y fait encore référence. */
export const estReferencee = (erreur: unknown) => codePostgres(erreur) === "23503";

/**
 * L'erreur viole-t-elle la contrainte nommée ?
 *
 * Même raison que plus haut : le nom de la contrainte n'est pas dans le message
 * de la `DrizzleQueryError` (qui cite la requête), mais dans sa cause —
 * `constraint_name` chez postgres-js, `constraint` chez PGlite, et toujours
 * dans le message du serveur.
 */
export function violeContrainte(erreur: unknown, nom: string): boolean {
  let courante: unknown = erreur;

  for (let profondeur = 0; profondeur < 5 && courante; profondeur += 1) {
    if (typeof courante === "object") {
      const objet = courante as Record<string, unknown>;
      if (objet.constraint_name === nom || objet.constraint === nom) return true;
      if (typeof objet.message === "string" && objet.message.includes(`"${nom}"`)) return true;
    }
    courante =
      typeof courante === "object" && courante !== null && "cause" in courante
        ? (courante as { cause: unknown }).cause
        : null;
  }

  return false;
}
