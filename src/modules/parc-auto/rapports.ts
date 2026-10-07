import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import type { DefinitionRapport } from "@/lib/rapports/types";

import { consommation, ENERGIES, prixAuLitre, type PleinMesure } from "./calcul";
import type { EnergieVehicule } from "./schema";

const JOUR_PLEIN = sql`(p.fait_le at time zone 'Africa/Abidjan')::date`;

export const RAPPORTS_PARC_AUTO: DefinitionRapport[] = [
  {
    cle: "cout-par-vehicule",
    module: "parc_auto",
    rubrique: "Parc automobile",
    titre: "Coût d'exploitation par véhicule",
    description: "Carburant et entretien de la période, kilomètres parcourus et coût au kilomètre, véhicule par véhicule.",
    droit: "parc_auto.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        immatriculation: string;
        vehicule: string;
        carburant: string;
        entretien: string;
        km: string | null;
      }>(sql`
        with pleins as (
          select p.actif_id, sum(p.montant) as carburant,
                 max(p.kilometrage) - min(p.kilometrage) as km
          from pleins_carburant p
          where p.organization_id = ${organizationId} and p.deleted_at is null
            and ${JOUR_PLEIN} between ${du}::date and ${au}::date
          group by p.actif_id
        ), entretien as (
          select i.actif_id, sum(i.cout) as entretien
          from interventions i
          where i.organization_id = ${organizationId} and i.deleted_at is null and not i.facturable
            and (i.effectuee_le at time zone 'Africa/Abidjan')::date between ${du}::date and ${au}::date
          group by i.actif_id
        )
        select v.immatriculation, trim(concat_ws(' ', v.marque, v.modele)) as vehicule,
               coalesce(p.carburant, 0) as carburant, coalesce(e.entretien, 0) as entretien, p.km
        from vehicules v
        join actifs a on a.id = v.actif_id
        left join pleins p on p.actif_id = v.actif_id
        left join entretien e on e.actif_id = v.actif_id
        where v.organization_id = ${organizationId} and v.deleted_at is null and a.deleted_at is null
          and (p.actif_id is not null or e.actif_id is not null)
        order by coalesce(p.carburant, 0) + coalesce(e.entretien, 0) desc, v.immatriculation
      `);
      return {
        colonnes: [
          { cle: "immatriculation", libelle: "Immatriculation", type: "texte" },
          { cle: "vehicule", libelle: "Véhicule", type: "texte" },
          { cle: "carburant", libelle: "Carburant", type: "montant" },
          { cle: "entretien", libelle: "Entretien", type: "montant" },
          { cle: "total", libelle: "Total", type: "montant" },
          { cle: "km", libelle: "Km parcourus", type: "entier", total: true },
          { cle: "par_km", libelle: "Coût au km", type: "montant", total: false },
        ],
        lignes: lignes.map((l) => {
          const total = Number(l.carburant) + Number(l.entretien);
          const km = l.km === null ? null : Number(l.km);
          return {
            immatriculation: l.immatriculation,
            vehicule: l.vehicule || null,
            carburant: Number(l.carburant),
            entretien: Number(l.entretien),
            total,
            km,
            par_km: km ? divideMoney(total, km) : null,
          };
        }),
        note: "Les kilomètres se lisent entre le premier et le dernier plein de la période qui portent un compteur. Un entretien refacturé à un client n'est pas compté.",
      };
    },
  },
  {
    cle: "consommation-carburant",
    module: "parc_auto",
    rubrique: "Parc automobile",
    titre: "Consommation de carburant",
    description: "Pleins, litres, dépense et consommation aux 100 km de chaque véhicule sur la période.",
    droit: "parc_auto.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const pleins = await db.execute<{
        actif_id: string;
        immatriculation: string;
        energie: EnergieVehicule | null;
        fait_le: string | Date;
        volume: string;
        montant: string;
        kilometrage: string | null;
        complet: boolean;
      }>(sql`
        select p.actif_id, v.immatriculation, v.energie, p.fait_le, p.volume, p.montant, p.kilometrage, p.complet
        from pleins_carburant p join vehicules v on v.actif_id = p.actif_id
        where p.organization_id = ${organizationId} and p.deleted_at is null
          and ${JOUR_PLEIN} between ${du}::date and ${au}::date
        order by v.immatriculation, p.fait_le
      `);

      const parVehicule = new Map<string, { immatriculation: string; energie: EnergieVehicule | null; pleins: PleinMesure[] }>();
      for (const p of pleins) {
        const v = parVehicule.get(p.actif_id) ?? { immatriculation: p.immatriculation, energie: p.energie, pleins: [] };
        v.pleins.push({
          faitLe: new Date(p.fait_le),
          volume: Number(p.volume),
          montant: Number(p.montant),
          kilometrage: p.kilometrage === null ? null : Number(p.kilometrage),
          complet: p.complet,
        });
        parVehicule.set(p.actif_id, v);
      }

      const lignes = [...parVehicule.values()].map((v) => {
        const volume = v.pleins.reduce((s, p) => s + p.volume, 0);
        const montant = v.pleins.reduce((s, p) => s + p.montant, 0);
        const mesure = consommation(v.pleins);
        return {
          immatriculation: v.immatriculation,
          energie: v.energie ? ENERGIES[v.energie] : null,
          pleins: v.pleins.length,
          volume,
          montant,
          prix: volume > 0 ? prixAuLitre(montant, volume) : null,
          km: mesure.distance || null,
          conso: mesure.mlPour100,
        };
      });
      lignes.sort((a, b) => b.montant - a.montant);

      return {
        colonnes: [
          { cle: "immatriculation", libelle: "Immatriculation", type: "texte" },
          { cle: "energie", libelle: "Énergie", type: "texte" },
          { cle: "pleins", libelle: "Pleins", type: "entier", total: true },
          { cle: "volume", libelle: "Litres", type: "quantite", total: true },
          { cle: "montant", libelle: "Dépense", type: "montant" },
          { cle: "prix", libelle: "Prix moyen du litre", type: "montant", total: false },
          { cle: "km", libelle: "Km mesurés", type: "entier", total: false },
          { cle: "conso", libelle: "Litres aux 100 km", type: "quantite", total: false },
        ],
        lignes,
        note: "Consommation « plein à plein » : il faut deux pleins complets avec compteur dans la période. Le premier sert de repère et son volume n'entre pas dans la mesure.",
      };
    },
  },
];
