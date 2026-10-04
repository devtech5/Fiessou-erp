import { CATEGORIES, type Categorie } from "@/lib/journal";
import type { FiltresJournal } from "@/lib/journal-requetes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

type Parametres = Record<string, string | string[] | undefined>;

const un = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : undefined);

/**
 * Filtres lus dans l'adresse, validés : la page et l'export CSV partagent la
 * même lecture, et un export reproduit exactement ce que l'écran montrait.
 */
export function lireFiltres(p: Parametres): FiltresJournal & { page: number } {
  const membre = un(p.membre);
  const categorie = un(p.categorie);
  const du = un(p.du);
  const au = un(p.au);
  const recherche = un(p.q);
  const page = Number(un(p.page) ?? "1");
  return {
    membre: membre && UUID.test(membre) ? membre : null,
    categorie: CATEGORIES.some((c) => c.cle === categorie) ? (categorie as Categorie) : null,
    du: du && DATE_ISO.test(du) ? du : null,
    au: au && DATE_ISO.test(au) ? au : null,
    recherche: recherche ? recherche.slice(0, 80) : null,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Adresse de la page pour des filtres donnés, avec un changement. */
export function adresse(base: string, f: FiltresJournal & { page?: number }, changement: Record<string, string | null>): string {
  const valeurs: Record<string, string | null | undefined> = {
    membre: f.membre,
    categorie: f.categorie,
    du: f.du,
    au: f.au,
    q: f.recherche,
    page: f.page && f.page > 1 ? String(f.page) : null,
    ...changement,
  };
  const parametres = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(valeurs)) if (valeur) parametres.set(cle, valeur);
  const chaine = parametres.toString();
  return chaine ? `${base}?${chaine}` : base;
}
