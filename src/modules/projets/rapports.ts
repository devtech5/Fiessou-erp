import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { DefinitionRapport } from "@/lib/rapports/types";

import { CATEGORIES_DEPENSE, categorieConnue } from "./calcul";

export const RAPPORTS_PROJETS: DefinitionRapport[] = [
  {
    cle: "depenses-par-projet",
    module: "projet",
    rubrique: "Projets",
    titre: "Dépenses par projet",
    description: "Pour chaque projet : payé sur la période, engagé, cumul depuis le début et budget restant.",
    droit: "projet.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ code: string | null; nom: string; budget: string | null; periode: string; engage: string; cumul: string }>(sql`
        select p.code, coalesce(p.nom, 'Hors projet (frais généraux)') as nom, p.budget,
               coalesce(sum(d.montant) filter (where d.statut = 'payee' and (d.payee_le at time zone 'Africa/Abidjan')::date between ${du}::date and ${au}::date), 0) as periode,
               coalesce(sum(d.montant) filter (where d.statut = 'approuvee'), 0) as engage,
               coalesce(sum(d.montant) filter (where d.statut = 'payee' and (d.payee_le at time zone 'Africa/Abidjan')::date <= ${au}::date), 0) as cumul
        from depenses d left join projets p on p.id = d.projet_id
        where d.organization_id = ${organizationId} and d.deleted_at is null
        group by p.id, p.code, p.nom, p.budget
        having coalesce(sum(d.montant) filter (where d.statut in ('payee', 'approuvee')), 0) > 0
        order by p.code nulls last
      `);
      return {
        colonnes: [
          { cle: "code", libelle: "Code", type: "texte" },
          { cle: "nom", libelle: "Projet", type: "texte" },
          { cle: "periode", libelle: "Payé sur la période", type: "montant" },
          { cle: "engage", libelle: "Approuvé, à payer", type: "montant" },
          { cle: "cumul", libelle: "Payé depuis le début", type: "montant" },
          { cle: "budget", libelle: "Budget", type: "montant" },
          { cle: "reste", libelle: "Reste au budget", type: "montant" },
        ],
        lignes: lignes.map((l) => {
          const budget = l.budget === null ? null : Number(l.budget);
          return {
            code: l.code,
            nom: l.nom,
            periode: Number(l.periode),
            engage: Number(l.engage),
            cumul: Number(l.cumul),
            budget,
            reste: budget === null ? null : budget - Number(l.cumul) - Number(l.engage),
          };
        }),
        note: "Le reste au budget déduit ce qui est payé et ce qui est approuvé : une dépense décidée consomme déjà l'enveloppe.",
      };
    },
  },
  {
    cle: "depenses-par-nature",
    module: "projet",
    rubrique: "Projets",
    titre: "Dépenses payées par nature",
    description: "Matériaux, transport, location, main-d'œuvre : ce qui a été payé sur la période, nature par nature.",
    droit: "projet.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ categorie: string; nombre: string; montant: string }>(sql`
        select categorie, count(*) as nombre, sum(montant) as montant
        from depenses
        where organization_id = ${organizationId} and deleted_at is null and statut = 'payee'
          and (payee_le at time zone 'Africa/Abidjan')::date between ${du}::date and ${au}::date
        group by categorie order by sum(montant) desc
      `);
      return {
        colonnes: [
          { cle: "nature", libelle: "Nature", type: "texte" },
          { cle: "compte", libelle: "Compte", type: "texte" },
          { cle: "nombre", libelle: "Dépenses", type: "entier", total: true },
          { cle: "montant", libelle: "Montant payé", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          nature: categorieConnue(l.categorie) ? CATEGORIES_DEPENSE[l.categorie].libelle : l.categorie,
          compte: categorieConnue(l.categorie) ? CATEGORIES_DEPENSE[l.categorie].compte : null,
          nombre: Number(l.nombre),
          montant: Number(l.montant),
        })),
      };
    },
  },
];
