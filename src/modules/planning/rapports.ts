import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import type { DefinitionRapport } from "@/lib/rapports/types";

import { STATUTS, type StatutPlanning } from "./calcul";

export const RAPPORTS_PLANNING: DefinitionRapport[] = [
  {
    cle: "planning-temps-par-statut",
    module: "planning",
    rubrique: "Planning",
    titre: "Temps déclaré par statut",
    description: "Pour chaque membre : heures passées en mission, sur le terrain, en courses, en réunion… d'après les créneaux de la période.",
    droit: "planning.equipe.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ nom: string; statut: StatutPlanning; creneaux: string; minutes: string }>(sql`
        with bornes as (
          select (${du}::date)::timestamp at time zone 'Africa/Abidjan' as debut,
                 (${au}::date + 1)::timestamp at time zone 'Africa/Abidjan' as fin
        )
        select u.full_name as nom, c.statut, count(*) as creneaux,
               sum(floor(extract(epoch from least(c.fin, b.fin) - greatest(c.debut, b.debut)) / 60))::bigint as minutes
        from creneaux_planning c
        cross join bornes b
        join users u on u.id = c.user_id
        where c.organization_id = ${organizationId} and c.deleted_at is null
          and c.debut < b.fin and c.fin > b.debut
        group by u.full_name, c.statut
        order by u.full_name, sum(floor(extract(epoch from least(c.fin, b.fin) - greatest(c.debut, b.debut)) / 60)) desc
      `);
      return {
        colonnes: [
          { cle: "nom", libelle: "Membre", type: "texte" },
          { cle: "statut", libelle: "Statut", type: "texte" },
          { cle: "creneaux", libelle: "Créneaux", type: "entier", total: true },
          // Millièmes d'heure : 7 500 se lit « 7,5 ».
          { cle: "heures", libelle: "Heures", type: "quantite", total: true },
        ],
        lignes: lignes.map((l) => ({
          nom: l.nom,
          statut: STATUTS[l.statut]?.libelle ?? l.statut,
          creneaux: Number(l.creneaux),
          heures: divideMoney(Number(l.minutes) * 1000, 60),
        })),
        note: "Un créneau à cheval sur la période n'est compté que pour sa partie comprise dedans. Les horaires habituels ne sont pas comptés : seul ce qui a été déclaré.",
      };
    },
  },
];
