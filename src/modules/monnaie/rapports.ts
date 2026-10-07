import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";

import { NOM_RESEAU } from "./calcul";
import type { Reseau } from "./schema";

const JOUR_OPERATION = sql`(o.created_at at time zone 'Africa/Abidjan')::date`;

export const RAPPORTS_MONNAIE: DefinitionRapport[] = [
  {
    cle: "guichet-par-reseau",
    module: "valeur_electronique",
    rubrique: "Guichet mobile money",
    titre: "Opérations et commissions par réseau",
    description: "Wave, Orange Money, MTN, Moov : dépôts, retraits, crédit vendu et commissions gagnées sur la période.",
    droit: "valeur_electronique.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        reseau: Reseau;
        operations: string;
        depots: string;
        retraits: string;
        credit: string;
        commissions: string;
      }>(sql`
        select o.reseau, count(*) filter (where o.type in ('depot', 'retrait', 'credit')) as operations,
               coalesce(sum(o.montant) filter (where o.type = 'depot'), 0) as depots,
               coalesce(sum(o.montant) filter (where o.type = 'retrait'), 0) as retraits,
               coalesce(sum(o.montant) filter (where o.type = 'credit'), 0) as credit,
               sum(o.commission) as commissions
        from operations_guichet o
        where o.organization_id = ${organizationId} and o.deleted_at is null and o.annulee_le is null
          and ${JOUR_OPERATION} between ${du}::date and ${au}::date
        group by o.reseau
        order by sum(o.commission) desc
      `);
      return {
        colonnes: [
          { cle: "reseau", libelle: "Réseau", type: "texte" },
          { cle: "operations", libelle: "Opérations clients", type: "entier", total: true },
          { cle: "depots", libelle: "Dépôts", type: "montant" },
          { cle: "retraits", libelle: "Retraits", type: "montant" },
          { cle: "credit", libelle: "Crédit vendu", type: "montant" },
          { cle: "commissions", libelle: "Commissions", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          reseau: NOM_RESEAU[l.reseau] ?? l.reseau,
          operations: Number(l.operations),
          depots: Number(l.depots),
          retraits: Number(l.retraits),
          credit: Number(l.credit),
          commissions: Number(l.commissions),
        })),
        note: "Les approvisionnements et déstockages de float ne sont pas des opérations clients ; leurs éventuelles commissions sont comptées. Les opérations annulées sont retirées.",
      };
    },
  },
  {
    cle: "guichet-sessions",
    module: "valeur_electronique",
    rubrique: "Guichet mobile money",
    titre: "Sessions de guichet",
    description: "Chaque ouverture de guichet : fond de caisse, opérations, commissions, espèces comptées à la clôture et écart.",
    droit: "valeur_electronique.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        numero: string;
        ouverte: string | Date;
        statut: "ouverte" | "cloturee";
        fond: string;
        operations: string;
        commissions: string;
        comptees: string | null;
        ecart: string | null;
      }>(sql`
        select s.numero, (s.ouverte_le at time zone 'Africa/Abidjan')::date as ouverte, s.statut, s.fond_caisse as fond,
               count(o.id) as operations, coalesce(sum(o.commission), 0) as commissions,
               s.especes_comptees as comptees, s.ecart_especes as ecart
        from sessions_guichet s
        left join operations_guichet o on o.session_id = s.id and o.deleted_at is null and o.annulee_le is null
        where s.organization_id = ${organizationId} and s.deleted_at is null
          and (s.ouverte_le at time zone 'Africa/Abidjan')::date between ${du}::date and ${au}::date
        group by s.id
        order by s.ouverte_le
      `);
      return {
        colonnes: [
          { cle: "numero", libelle: "Session", type: "texte" },
          { cle: "ouverte", libelle: "Ouverte le", type: "date" },
          { cle: "statut", libelle: "État", type: "texte" },
          { cle: "fond", libelle: "Fond de caisse", type: "montant", total: false },
          { cle: "operations", libelle: "Opérations", type: "entier", total: true },
          { cle: "commissions", libelle: "Commissions", type: "montant" },
          { cle: "comptees", libelle: "Espèces comptées", type: "montant", total: false },
          { cle: "ecart", libelle: "Écart", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          numero: l.numero,
          ouverte: jourIso(l.ouverte),
          statut: l.statut === "ouverte" ? "Ouverte" : "Clôturée",
          fond: Number(l.fond),
          operations: Number(l.operations),
          commissions: Number(l.commissions),
          comptees: l.comptees === null ? null : Number(l.comptees),
          ecart: l.ecart === null ? null : Number(l.ecart),
        })),
        note: "Un écart négatif est un manquant en caisse ; le total des écarts mesure la fiabilité du guichet sur la période.",
      };
    },
  },
];
