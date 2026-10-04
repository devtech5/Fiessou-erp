import { exigerEntreprise } from "@/lib/auth/dal";
import { tracer } from "@/lib/audit";
import { peut } from "@/lib/droits/garde";
import { appareil, categorieAction, CATEGORIES, libelleAction, moduleAction, resumeDetail } from "@/lib/journal";
import { acteursJournal, lireJournal } from "@/lib/journal-requetes";

import { lireFiltres } from "../filtres";

/** Plafond d'un export : au-delà, resserrer la période. */
const LIGNES_MAX = 20_000;

const MOMENT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Africa/Abidjan",
});

/** Cellule CSV : guillemets doublés, et pas de formule — un « = » en tête s'exécuterait dans un tableur. */
function cellule(valeur: string): string {
  const sure = /^[=+\-@]/.test(valeur) ? `'${valeur}` : valeur;
  return `"${sure.replace(/"/g, '""')}"`;
}

/**
 * Export du journal, avec les filtres de l'écran. Séparateur point-virgule et
 * marque d'ordre des octets : Excel en français l'ouvre tel quel. L'export
 * lui-même se trace — sortir le journal est un geste.
 */
export async function GET(requete: Request) {
  const session = await exigerEntreprise();
  if (!(await peut("organisation.journal.consulter"))) return new Response("Accès refusé.", { status: 403 });

  const filtres = lireFiltres(Object.fromEntries(new URL(requete.url).searchParams));
  const [{ lignes, total }, personnes] = await Promise.all([
    lireJournal(session.organizationId, filtres, 1, LIGNES_MAX),
    acteursJournal(session.organizationId),
  ]);
  const noms = new Map(personnes.map((p) => [p.userId, p.nom]));
  const familles = new Map(CATEGORIES.map((c) => [c.cle, c.libelle]));

  const entete = ["Date", "Personne", "Famille", "Module", "Geste", "Code", "Avant", "Après", "Appareil", "Adresse IP"];
  const corps = lignes.map((l) =>
    [
      MOMENT.format(l.le),
      l.acteur,
      familles.get(categorieAction(l.action)) ?? "",
      moduleAction(l.action),
      libelleAction(l.action),
      l.action,
      resumeDetail(l.avant, noms),
      resumeDetail(l.apres, noms),
      appareil(l.userAgent),
      l.ipAddress ?? "",
    ]
      .map(cellule)
      .join(";"),
  );

  await tracer({
    action: "journal.exporter",
    entite: "journal",
    apres: { lignes: lignes.length, total, ...filtres, page: undefined },
  });

  const jour = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${[entete.map(cellule).join(";"), ...corps].join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="journal-activite-${jour}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
