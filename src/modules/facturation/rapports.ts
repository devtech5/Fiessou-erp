import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";


/** Tranches d'ancienneté d'une créance ou d'une dette, en jours après l'échéance. */
const TRANCHES = sql`
  sum(reste) filter (where retard <= 0) as non_echu,
  sum(reste) filter (where retard between 1 and 30) as a30,
  sum(reste) filter (where retard between 31 and 60) as a60,
  sum(reste) filter (where retard between 61 and 90) as a90,
  sum(reste) filter (where retard > 90) as plus90,
  sum(reste) as total
`;

export const COLONNES_ANCIENNETE = [
  { cle: "non_echu", libelle: "Non échu", type: "montant" },
  { cle: "a30", libelle: "1 à 30 j", type: "montant" },
  { cle: "a60", libelle: "31 à 60 j", type: "montant" },
  { cle: "a90", libelle: "61 à 90 j", type: "montant" },
  { cle: "plus90", libelle: "Plus de 90 j", type: "montant" },
  { cle: "total", libelle: "Total dû", type: "montant" },
] as const;

export type LigneAnciennete = { tiers: string; non_echu: string | null; a30: string | null; a60: string | null; a90: string | null; plus90: string | null; total: string };

export const ancienneteEnLigne = (l: LigneAnciennete) => ({
  tiers: l.tiers,
  non_echu: Number(l.non_echu ?? 0) || null,
  a30: Number(l.a30 ?? 0) || null,
  a60: Number(l.a60 ?? 0) || null,
  a90: Number(l.a90 ?? 0) || null,
  plus90: Number(l.plus90 ?? 0) || null,
  total: Number(l.total),
});

export const RAPPORTS_COMMERCIAL: DefinitionRapport[] = [
  {
    cle: "factures-par-client",
    module: "tiers",
    rubrique: "Commercial",
    titre: "Facturation par client",
    description: "Factures émises sur la période pour chaque client : montants, déjà encaissé, reste dû.",
    droit: "commercial.piece.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ client: string; factures: string; ht: string; ttc: string; encaisse: string }>(sql`
        select p.client_nom as client, count(*) as factures, sum(p.total_ht) as ht, sum(p.total_ttc) as ttc,
               coalesce(sum((select sum(r.montant) from reglements_piece r where r.piece_id = p.id and r.deleted_at is null and r.date_reglement <= ${au}::date)), 0) as encaisse
        from pieces_commerciales p
        where p.organization_id = ${organizationId} and p.nature = 'facture' and p.statut not in ('brouillon', 'annulee')
          and p.date_piece between ${du}::date and ${au}::date
        group by p.client_nom order by sum(p.total_ttc) desc
      `);
      return {
        colonnes: [
          { cle: "client", libelle: "Client", type: "texte" },
          { cle: "factures", libelle: "Factures", type: "entier", total: true },
          { cle: "ht", libelle: "Total HT", type: "montant" },
          { cle: "ttc", libelle: "Total TTC", type: "montant" },
          { cle: "encaisse", libelle: "Encaissé", type: "montant" },
          { cle: "reste", libelle: "Reste dû", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          client: l.client,
          factures: Number(l.factures),
          ht: Number(l.ht),
          ttc: Number(l.ttc),
          encaisse: Number(l.encaisse),
          reste: Number(l.ttc) - Number(l.encaisse),
        })),
        note: "Factures émises seulement : brouillons et factures annulées exclus. Les avoirs ne sont pas déduits.",
      };
    },
  },
  {
    cle: "creances-anciennete",
    module: "tiers",
    rubrique: "Commercial",
    titre: "Créances clients par ancienneté",
    description: "Ce que chaque client doit à la date choisie, réparti selon le retard sur l'échéance.",
    droit: "commercial.piece.consulter",
    periode: "situation",
    async executer(organizationId, { au }) {
      const lignes = await db.execute<LigneAnciennete>(sql`
        select tiers, ${TRANCHES}
        from (
          select p.client_nom as tiers,
                 ${au}::date - coalesce(p.echeance, p.date_piece) as retard,
                 p.total_ttc - coalesce((select sum(r.montant) from reglements_piece r where r.piece_id = p.id and r.deleted_at is null and r.date_reglement <= ${au}::date), 0) as reste
          from pieces_commerciales p
          where p.organization_id = ${organizationId} and p.nature = 'facture' and p.statut not in ('brouillon', 'annulee')
            and p.date_piece <= ${au}::date
        ) f
        where reste > 0
        group by tiers order by sum(reste) desc
      `);
      return {
        colonnes: [{ cle: "tiers", libelle: "Client", type: "texte" }, ...COLONNES_ANCIENNETE],
        lignes: lignes.map(ancienneteEnLigne),
        note: "Le retard se compte depuis l'échéance de la facture, ou sa date quand elle n'en a pas.",
      };
    },
  },
  {
    cle: "encaissements-clients",
    module: "tiers",
    rubrique: "Commercial",
    titre: "Encaissements de factures",
    description: "Chaque règlement reçu sur une facture : date, client, facture réglée, montant.",
    droit: "commercial.piece.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ date: string | Date; numero: string; client: string; facture: string | null; reference: string | null; montant: string }>(sql`
        select r.date_reglement as date, r.numero, p.client_nom as client, p.numero as facture, r.reference, r.montant
        from reglements_piece r join pieces_commerciales p on p.id = r.piece_id
        where p.organization_id = ${organizationId} and r.deleted_at is null
          and r.date_reglement between ${du}::date and ${au}::date
        order by r.date_reglement, r.numero
      `);
      return {
        colonnes: [
          { cle: "date", libelle: "Date", type: "date" },
          { cle: "numero", libelle: "Règlement", type: "texte" },
          { cle: "client", libelle: "Client", type: "texte" },
          { cle: "facture", libelle: "Facture", type: "texte" },
          { cle: "reference", libelle: "Référence", type: "texte" },
          { cle: "montant", libelle: "Montant", type: "montant" },
        ],
        lignes: lignes.map((l) => ({ ...l, date: jourIso(l.date), montant: Number(l.montant) })),
      };
    },
  },
];
