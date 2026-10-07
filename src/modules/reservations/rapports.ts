import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";

import type { TypeRessource } from "./schema";

const TYPES: Record<TypeRessource, string> = {
  equipement: "Équipement",
  chambre: "Chambre",
  salle: "Salle",
  creneau: "Créneau",
};

export const RAPPORTS_RESERVATIONS: DefinitionRapport[] = [
  {
    cle: "occupation-par-ressource",
    module: "reservation",
    rubrique: "Réservations et locations",
    titre: "Occupation et chiffre d'affaires par ressource",
    description: "Pour chaque chambre, salle ou équipement : jours loués sur la période, taux d'occupation, contrats signés et leur montant.",
    droit: "reservation.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        code: string;
        designation: string;
        type: TypeRessource;
        quantite: number;
        jours_loues: string;
        contrats: string;
        montant: string;
      }>(sql`
        select r.code, r.designation, r.type, r.quantite,
               coalesce(sum((least(c.fin, ${au}::date) - greatest(c.debut, ${du}::date) + 1) * c.quantite)
                 filter (where c.debut <= ${au}::date and c.fin >= ${du}::date), 0) as jours_loues,
               count(c.id) filter (where c.debut between ${du}::date and ${au}::date) as contrats,
               coalesce(sum(c.montant) filter (where c.debut between ${du}::date and ${au}::date), 0) as montant
        from ressources r
        left join contrats_location c on c.ressource_id = r.id and c.deleted_at is null and c.statut <> 'annule'
        where r.organization_id = ${organizationId} and r.deleted_at is null and r.statut <> 'retiree'
        group by r.id, r.code, r.designation, r.type, r.quantite
        order by 7 desc, r.code
      `);
      const jours = (Date.parse(`${au}T00:00:00Z`) - Date.parse(`${du}T00:00:00Z`)) / 86_400_000 + 1;
      return {
        colonnes: [
          { cle: "code", libelle: "Code", type: "texte" },
          { cle: "designation", libelle: "Ressource", type: "texte" },
          { cle: "type", libelle: "Type", type: "texte" },
          { cle: "disponibles", libelle: "Jours disponibles", type: "entier", total: true },
          { cle: "jours_loues", libelle: "Jours loués", type: "entier", total: true },
          { cle: "occupation", libelle: "Occupation", type: "taux_bp", total: false },
          { cle: "contrats", libelle: "Contrats commencés", type: "entier", total: true },
          { cle: "montant", libelle: "Montant des contrats", type: "montant" },
        ],
        lignes: lignes.map((l) => {
          const disponibles = jours * Number(l.quantite);
          const loues = Number(l.jours_loues);
          return {
            code: l.code,
            designation: l.designation,
            type: TYPES[l.type] ?? l.type,
            disponibles,
            jours_loues: loues,
            occupation: disponibles > 0 ? divideMoney(loues * 10_000, disponibles) : null,
            contrats: Number(l.contrats),
            montant: Number(l.montant),
          };
        }),
        note: "Les jours loués couvrent la partie de chaque contrat comprise dans la période, multipliée par la quantité louée. Le montant est celui des contrats qui commencent dans la période.",
      };
    },
  },
  {
    cle: "cautions-detenues",
    module: "reservation",
    rubrique: "Réservations et locations",
    titre: "Cautions détenues",
    description: "Les cautions encaissées et pas encore restituées à la date choisie : à qui, pour quoi, et depuis quand.",
    droit: "reservation.consulter",
    periode: "situation",
    async executer(organizationId, { au }) {
      const lignes = await db.execute<{
        numero: string;
        ressource: string;
        client: string | null;
        debut: string | Date;
        fin: string | Date;
        caution: string;
      }>(sql`
        select c.numero, r.designation as ressource, t.nom as client, c.debut, c.fin, c.caution
        from contrats_location c
        join ressources r on r.id = c.ressource_id
        left join tiers t on t.id = c.client_id
        where c.organization_id = ${organizationId} and c.deleted_at is null and c.caution > 0
          and c.remis_le is not null and (c.remis_le at time zone 'Africa/Abidjan')::date <= ${au}::date
          and (c.restitue_le is null or (c.restitue_le at time zone 'Africa/Abidjan')::date > ${au}::date)
        order by c.fin, c.numero
      `);
      return {
        colonnes: [
          { cle: "numero", libelle: "Contrat", type: "texte" },
          { cle: "ressource", libelle: "Ressource", type: "texte" },
          { cle: "client", libelle: "Client", type: "texte" },
          { cle: "debut", libelle: "Du", type: "date" },
          { cle: "fin", libelle: "Au", type: "date" },
          { cle: "caution", libelle: "Caution", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          numero: l.numero,
          ressource: l.ressource,
          client: l.client,
          debut: jourIso(l.debut),
          fin: jourIso(l.fin),
          caution: Number(l.caution),
        })),
        note: "Le total doit retomber sur le solde du compte 165, Dépôts et cautionnements reçus.",
      };
    },
  },
  {
    cle: "abonnements-par-formule",
    module: "reservation",
    rubrique: "Réservations et locations",
    titre: "Abonnements vendus par formule",
    description: "Abonnements qui commencent dans la période, formule par formule : nombre, montant et passages enregistrés.",
    droit: "reservation.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ formule: string; abonnements: string; montant: string; passages: string }>(sql`
        select a.formule, count(*) as abonnements, sum(a.montant) as montant,
               coalesce(sum((select count(*) from passages_abonnement p where p.abonnement_id = a.id and p.deleted_at is null)), 0) as passages
        from abonnements a
        where a.organization_id = ${organizationId} and a.deleted_at is null
          and a.debut between ${du}::date and ${au}::date
        group by a.formule
        order by sum(a.montant) desc
      `);
      return {
        colonnes: [
          { cle: "formule", libelle: "Formule", type: "texte" },
          { cle: "abonnements", libelle: "Abonnements", type: "entier", total: true },
          { cle: "montant", libelle: "Montant", type: "montant" },
          { cle: "moyen", libelle: "Prix moyen", type: "montant", total: false },
          { cle: "passages", libelle: "Passages", type: "entier", total: true },
        ],
        lignes: lignes.map((l) => ({
          formule: l.formule,
          abonnements: Number(l.abonnements),
          montant: Number(l.montant),
          moyen: divideMoney(Number(l.montant), Number(l.abonnements)),
          passages: Number(l.passages),
        })),
      };
    },
  },
];
