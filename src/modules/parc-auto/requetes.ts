import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { listerActifs, listerEcheances, type ActifSuivi, type LigneEcheance } from "@/modules/actifs/requetes";
import { employees } from "@/modules/personnes/schema";

import { consommation, coutAuKm, type Consommation } from "./calcul";
import { pleinsCarburant, vehicules, type PleinCarburant, type Vehicule } from "./schema";

export interface VehiculeSuivi extends ActifSuivi {
  /** Fiche de véhicule. Nulle pour un véhicule ouvert depuis l'écran Actifs, à compléter. */
  fiche: Vehicule | null;
  carburantTotal: number;
  carburantMois: number;
  volumeTotal: number;
  consommation: Consommation;
  coutAuKm: number | null;
  /** Échéance la plus urgente, toutes natures confondues. */
  prochaine: LigneEcheance | null;
  echeancesDepassees: number;
}

/**
 * Le parc automobile : les actifs de type véhicule, leur fiche, leur
 * carburant et leur échéance la plus urgente.
 *
 * Trois lectures pour tout le parc, assemblées ici : les actifs (avec coût
 * d'entretien et dernier relevé), les fiches, les pleins. Une flotte de PME
 * compte quelques dizaines de véhicules et quelques milliers de pleins par an.
 */
export async function listerVehicules(organizationId: string, aujourdhui = new Date()): Promise<VehiculeSuivi[]> {
  const [tous, fiches, pleins, echeances] = await Promise.all([
    listerActifs(organizationId),
    db.select().from(vehicules).where(eq(vehicules.organizationId, organizationId)),
    db
      .select()
      .from(pleinsCarburant)
      .where(and(eq(pleinsCarburant.organizationId, organizationId), isNull(pleinsCarburant.deletedAt))),
    listerEcheances(organizationId, aujourdhui),
  ]);

  const debutMois = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), 1));
  const fichePar = new Map(fiches.map((f) => [f.actifId, f]));
  const pleinsPar = new Map<string, PleinCarburant[]>();
  for (const p of pleins) pleinsPar.set(p.actifId, [...(pleinsPar.get(p.actifId) ?? []), p]);
  const echeancesPar = new Map<string, LigneEcheance[]>();
  for (const e of echeances) echeancesPar.set(e.actifId, [...(echeancesPar.get(e.actifId) ?? []), e]);

  return tous
    .filter((a) => a.type === "vehicule" && a.proprietaire === null)
    .map((a) => {
      const sesPleins = pleinsPar.get(a.id) ?? [];
      const conso = consommation(sesPleins);
      const carburantTotal = sesPleins.reduce((s, p) => s + p.montant, 0);
      // Coût au km : tout le carburant et tout l'entretien rapportés à la
      // seule distance mesurée entre pleins complets. Approximation prudente,
      // qui surestime plutôt qu'elle ne flatte.
      const sesEcheances = echeancesPar.get(a.id) ?? [];
      return {
        ...a,
        fiche: fichePar.get(a.id) ?? null,
        carburantTotal,
        carburantMois: sesPleins.filter((p) => p.faitLe >= debutMois).reduce((s, p) => s + p.montant, 0),
        volumeTotal: sesPleins.reduce((s, p) => s + p.volume, 0),
        consommation: conso,
        coutAuKm: coutAuKm(carburantTotal, a.coutMaintenance, conso.distance),
        prochaine: sesEcheances[0] ?? null,
        echeancesDepassees: sesEcheances.filter((e) => e.gravite === "depassee").length,
      };
    });
}

export async function vehiculeDe(organizationId: string, actifId: string, aujourdhui = new Date()) {
  return (await listerVehicules(organizationId, aujourdhui)).find((v) => v.id === actifId) ?? null;
}

export interface PleinAffiche extends PleinCarburant {
  vehicule: string;
  conducteur: string | null;
}

/** Pleins, du plus récent au plus ancien ; d'un véhicule si précisé. */
export async function listerPleins(organizationId: string, actifId?: string): Promise<PleinAffiche[]> {
  const [lignes, tous] = await Promise.all([
    db
      .select({ plein: pleinsCarburant, conducteur: employees.nom })
      .from(pleinsCarburant)
      .leftJoin(employees, eq(employees.id, pleinsCarburant.conducteurId))
      .where(
        and(
          eq(pleinsCarburant.organizationId, organizationId),
          isNull(pleinsCarburant.deletedAt),
          ...(actifId ? [eq(pleinsCarburant.actifId, actifId)] : []),
        ),
      )
      .orderBy(desc(pleinsCarburant.faitLe)),
    listerActifs(organizationId),
  ]);
  const noms = new Map(tous.map((a) => [a.id, `${a.code} · ${a.designation}`]));
  return lignes.map((l) => ({ ...l.plein, vehicule: noms.get(l.plein.actifId) ?? "—", conducteur: l.conducteur }));
}
