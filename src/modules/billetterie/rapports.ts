import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";

import { capacite } from "./calcul";

const JOUR_DEPART = sql`(d.part_le at time zone 'Africa/Abidjan')::date`;

export const RAPPORTS_BILLETTERIE: DefinitionRapport[] = [
  {
    cle: "billetterie-par-ligne",
    module: "billetterie",
    rubrique: "Billetterie",
    titre: "Remplissage et recette par ligne",
    description: "Pour chaque ligne : départs, places offertes, billets vendus, passagers embarqués, taux de remplissage et recette.",
    droit: "billetterie.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        code: string;
        trajet: string;
        departs: string;
        rangees: string;
        vendus: string;
        embarques: string;
        absents: string;
        recette: string;
      }>(sql`
        with d as (
          select d.id, d.ligne_id, d.rangees
          from departs d
          where d.organization_id = ${organizationId} and d.deleted_at is null and d.statut <> 'annule'
            and ${JOUR_DEPART} between ${du}::date and ${au}::date
        ), b as (
          select b.depart_id,
                 count(*) filter (where b.statut <> 'annule') as vendus,
                 count(*) filter (where b.statut = 'embarque') as embarques,
                 count(*) filter (where b.statut = 'non_presente') as absents,
                 coalesce(sum(b.montant) filter (where b.statut <> 'annule'), 0) as recette
          from billets b join d on d.id = b.depart_id
          where b.deleted_at is null
          group by b.depart_id
        )
        select l.code, l.depart || ' → ' || l.arrivee as trajet, count(*) as departs, sum(d.rangees) as rangees,
               coalesce(sum(b.vendus), 0) as vendus, coalesce(sum(b.embarques), 0) as embarques,
               coalesce(sum(b.absents), 0) as absents, coalesce(sum(b.recette), 0) as recette
        from d join lignes_transport l on l.id = d.ligne_id
        left join b on b.depart_id = d.id
        group by l.id, l.code, l.depart, l.arrivee
        order by coalesce(sum(b.recette), 0) desc, l.code
      `);
      return {
        colonnes: [
          { cle: "code", libelle: "Ligne", type: "texte" },
          { cle: "trajet", libelle: "Trajet", type: "texte" },
          { cle: "departs", libelle: "Départs", type: "entier", total: true },
          { cle: "places", libelle: "Places offertes", type: "entier", total: true },
          { cle: "vendus", libelle: "Billets vendus", type: "entier", total: true },
          { cle: "embarques", libelle: "Embarqués", type: "entier", total: true },
          { cle: "absents", libelle: "Non présentés", type: "entier", total: true },
          { cle: "remplissage", libelle: "Remplissage", type: "taux_bp", total: false },
          { cle: "recette", libelle: "Recette", type: "montant" },
        ],
        lignes: lignes.map((l) => {
          const places = capacite(Number(l.rangees));
          const vendus = Number(l.vendus);
          return {
            code: l.code,
            trajet: l.trajet,
            departs: Number(l.departs),
            places,
            vendus,
            embarques: Number(l.embarques),
            absents: Number(l.absents),
            remplissage: places > 0 ? divideMoney(vendus * 10_000, places) : null,
            recette: Number(l.recette),
          };
        }),
        note: "Les départs annulés ne comptent pas. La recette est le prix TTC des billets non annulés des départs de la période.",
      };
    },
  },
  {
    cle: "billetterie-par-jour",
    module: "billetterie",
    rubrique: "Billetterie",
    titre: "Ventes de billets par jour",
    description: "Billets vendus chaque jour, ventilés entre espèces, mobile money et banque, guichet et en ligne.",
    droit: "billetterie.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        jour: string | Date;
        billets: string;
        especes: string;
        mobile_money: string;
        banque: string;
        en_ligne: string;
        total: string;
      }>(sql`
        select (b.created_at at time zone 'Africa/Abidjan')::date as jour, count(*) as billets,
               coalesce(sum(b.montant) filter (where b.moyen = 'especes'), 0) as especes,
               coalesce(sum(b.montant) filter (where b.moyen = 'mobile_money'), 0) as mobile_money,
               coalesce(sum(b.montant) filter (where b.moyen = 'banque'), 0) as banque,
               coalesce(sum(b.montant) filter (where b.canal = 'en_ligne'), 0) as en_ligne,
               sum(b.montant) as total
        from billets b
        where b.organization_id = ${organizationId} and b.deleted_at is null and b.statut <> 'annule'
          and (b.created_at at time zone 'Africa/Abidjan')::date between ${du}::date and ${au}::date
        group by 1 order by 1
      `);
      return {
        colonnes: [
          { cle: "jour", libelle: "Jour", type: "date" },
          { cle: "billets", libelle: "Billets", type: "entier", total: true },
          { cle: "especes", libelle: "Espèces", type: "montant" },
          { cle: "mobile_money", libelle: "Mobile money", type: "montant" },
          { cle: "banque", libelle: "Banque", type: "montant" },
          { cle: "total", libelle: "Total", type: "montant" },
          { cle: "en_ligne", libelle: "Dont vendus en ligne", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          jour: jourIso(l.jour),
          billets: Number(l.billets),
          especes: Number(l.especes),
          mobile_money: Number(l.mobile_money),
          banque: Number(l.banque),
          total: Number(l.total),
          en_ligne: Number(l.en_ligne),
        })),
        note: "Un billet compte le jour de sa vente, quel que soit son départ. Les billets annulés depuis sont retirés.",
      };
    },
  },
];
