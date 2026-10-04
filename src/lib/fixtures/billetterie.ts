import "server-only";

import { and, eq } from "drizzle-orm";

import type { Transaction } from "@/lib/sequences";
import { siegesDuVehicule } from "@/modules/billetterie/calcul";
import {
  annulerBilletDans,
  changerStatutDepartDans,
  creerLigneDans,
  embarquerDans,
  programmerDepartDans,
  vendreBilletsDans,
} from "@/modules/billetterie/creation";
import { billets } from "@/modules/billetterie/schema";

/**
 * Amorçage de la billetterie de transport.
 *
 * Passe par les VRAIES fonctions du module — programmation, vente au plan
 * (avec son verrou et son contrôle de siège), contrôle à la montée, départ,
 * annulation — et non par des insertions directes : le jeu prouve que les
 * règles laissent passer une journée de gare réelle.
 */

const LIGNES = [
  { code: "ABJ-BKE", depart: "Abidjan", arrivee: "Bouaké", dureeMinutes: 300, distanceKm: 350, tarif: 6_000 },
  { code: "ABJ-YAM", depart: "Abidjan", arrivee: "Yamoussoukro", dureeMinutes: 210, distanceKm: 240, tarif: 4_500 },
  { code: "ABJ-SPD", depart: "Abidjan", arrivee: "San Pedro", dureeMinutes: 360, distanceKm: 350, tarif: 7_000 },
  { code: "ABJ-KOR", depart: "Abidjan", arrivee: "Korhogo", dureeMinutes: 600, distanceKm: 630, tarif: 12_000 },
  { code: "ABJ-MAN", depart: "Abidjan", arrivee: "Man", dureeMinutes: 480, distanceKm: 570, tarif: 10_000 },
  { code: "ABJ-DAL", depart: "Abidjan", arrivee: "Daloa", dureeMinutes: 330, distanceKm: 380, tarif: 7_500 },
];

type Suite = "parti" | "embarquement" | null;

const DEPARTS: { ligne: number; jour: 0 | 1; heure: string; vehicule: string; rangees: number; vendus: number; suite: Suite }[] = [
  { ligne: 0, jour: 0, heure: "07:00", vehicule: "Car 60 — 4521 AB 01", rangees: 15, vendus: 40, suite: "parti" },
  { ligne: 1, jour: 0, heure: "14:30", vehicule: "Minibus 32 — 7788 CD 01", rangees: 8, vendus: 26, suite: "embarquement" },
  { ligne: 0, jour: 0, heure: "16:00", vehicule: "Car 60 — 4522 AB 01", rangees: 15, vendus: 19, suite: null },
  { ligne: 3, jour: 0, heure: "18:00", vehicule: "Car 60 — 4523 AB 01", rangees: 15, vendus: 9, suite: null },
  { ligne: 2, jour: 1, heure: "06:30", vehicule: "Car 60 — 4521 AB 01", rangees: 15, vendus: 5, suite: null },
  { ligne: 4, jour: 1, heure: "07:30", vehicule: "Minibus 32 — 7789 CD 01", rangees: 8, vendus: 6, suite: null },
];

const NOMS = [
  "Kouassi Ange", "Kouassi Adjoua", "N'Dri Serge", "Bamba Awa", "Bamba Ismaël", "Silué Fatoumata",
  "Yao Emmanuel", "Diarra Mariam", "Koffi Rodrigue", "Konan Aya", "Ouattara Seydou", "Traoré Kadiatou",
  "Gbagbo Prisca", "Coulibaly Moussa", "Koné Salimata", "Aké Désiré", "Tanoh Grâce", "Doumbia Issa",
];

/** Sièges vendus « en grappes », comme au guichet : des familles côte à côte, des trous ailleurs. */
function siegesVendus(rangees: number, nombre: number): string[] {
  const tous = siegesDuVehicule(rangees);
  const choisis: string[] = [];
  for (let i = 0; choisis.length < nombre && i < tous.length; i++) {
    if (i % 7 !== 5) choisis.push(tous[i]);
  }
  return choisis;
}

export async function amorcerBilletterie(
  tx: Transaction,
  organizationId: string,
  userId: string,
): Promise<{ lignes: number; departs: number; billets: number }> {
  const lignes: string[] = [];
  for (const ligne of LIGNES) lignes.push((await creerLigneDans(tx, organizationId, ligne, userId)).id);

  const aujourdHui = new Date().toISOString().slice(0, 10);
  const demain = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  let emis = 0;
  let nom = 0;

  for (const [index, d] of DEPARTS.entries()) {
    const { id } = await programmerDepartDans(
      tx,
      organizationId,
      {
        ligneId: lignes[d.ligne],
        partLe: new Date(`${d.jour === 0 ? aujourdHui : demain}T${d.heure}:00Z`),
        vehicule: d.vehicule,
        rangees: d.rangees,
      },
      userId,
    );

    // Une vente par groupe de un à trois sièges : chaque passager a son nom.
    const sieges = siegesVendus(d.rangees, d.vendus);
    for (let i = 0; i < sieges.length; ) {
      const groupe = sieges.slice(i, i + 1 + ((i + index) % 3));
      await vendreBilletsDans(
        tx,
        organizationId,
        {
          departId: id,
          sieges: groupe,
          passagers: groupe.map(() => ({
            nom: NOMS[nom++ % NOMS.length],
            telephone: `07 ${String(10 + (nom % 89)).padStart(2, "0")} 45 12 ${String(nom % 100).padStart(2, "0")}`,
            piece: nom % 3 === 0 ? null : `CI ${String(234_519 + nom * 37).padStart(7, "0")}`,
          })),
          moyen: i % 4 === 3 ? "mobile_money" : "especes",
          canal: i % 5 === 4 ? "en_ligne" : "guichet",
        },
        userId,
      );
      emis += groupe.length;
      i += groupe.length;
    }

    if (d.suite) {
      await changerStatutDepartDans(tx, organizationId, id, "embarquement", userId);
      // On fait monter les trois quarts : le reste sera « non présenté » au départ.
      const aBord = await tx
        .select({ id: billets.id })
        .from(billets)
        .where(and(eq(billets.departId, id), eq(billets.statut, "valide")));
      for (const billet of aBord.slice(0, Math.floor((aBord.length * 3) / 4))) {
        await embarquerDans(tx, organizationId, billet.id, userId);
      }
      if (d.suite === "parti") await changerStatutDepartDans(tx, organizationId, id, "parti", userId);
    }

    // Un passager du premier départ de demain se désiste : billet annulé, recette contrepassée.
    if (index === 4) {
      const [billet] = await tx
        .select({ id: billets.id })
        .from(billets)
        .where(and(eq(billets.departId, id), eq(billets.statut, "valide")))
        .limit(1);
      if (billet) await annulerBilletDans(tx, organizationId, billet.id, "Voyage reporté par le client", userId);
    }
  }

  return { lignes: LIGNES.length, departs: DEPARTS.length, billets: emis };
}
