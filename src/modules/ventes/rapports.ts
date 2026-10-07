import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";


const MOYENS: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile money",
  carte: "Carte bancaire",
  banque: "Virement, chèque",
  credit: "À crédit",
};

/**
 * Les ventes de caisse se datent à l'encaissement, à l'heure d'Abidjan :
 * un ticket de 23 h 30 appartient à la journée où il a été encaissé.
 */
const JOUR_VENTE = sql`(v.encaissee_le at time zone 'Africa/Abidjan')::date`;

export const RAPPORTS_VENTES: DefinitionRapport[] = [
  {
    cle: "ventes-par-jour",
    module: "pos",
    rubrique: "Ventes en caisse",
    titre: "Ventes par jour",
    description: "Nombre de tickets, chiffre d'affaires, remises et panier moyen, jour par jour.",
    droit: "pos.vente.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ jour: string | Date; tickets: string; ht: string; tva: string; ttc: string; remise: string }>(sql`
        select ${JOUR_VENTE} as jour, count(*) as tickets, sum(v.total_ht) as ht, sum(v.total_tva) as tva, sum(v.total_ttc) as ttc, sum(v.total_remise) as remise
        from ventes v
        where v.organization_id = ${organizationId} and v.statut = 'encaissee'
          and ${JOUR_VENTE} between ${du}::date and ${au}::date
        group by 1 order by 1
      `);
      return {
        colonnes: [
          { cle: "jour", libelle: "Jour", type: "date" },
          { cle: "tickets", libelle: "Tickets", type: "entier", total: true },
          { cle: "ht", libelle: "Total HT", type: "montant" },
          { cle: "tva", libelle: "TVA", type: "montant" },
          { cle: "ttc", libelle: "Total TTC", type: "montant" },
          { cle: "remise", libelle: "Remises", type: "montant" },
          { cle: "panier", libelle: "Panier moyen", type: "montant", total: false },
        ],
        lignes: lignes.map((l) => ({
          jour: jourIso(l.jour),
          tickets: Number(l.tickets),
          ht: Number(l.ht),
          tva: Number(l.tva),
          ttc: Number(l.ttc),
          remise: Number(l.remise),
          panier: divideMoney(Number(l.ttc), Number(l.tickets)),
        })),
        note: "Tickets encaissés seulement : une vente annulée n'y figure pas.",
      };
    },
  },
  {
    cle: "ventes-par-article",
    module: "pos",
    rubrique: "Ventes en caisse",
    titre: "Ventes et marge par article",
    description: "Quantités vendues, chiffre d'affaires, coût de revient et marge de chaque article et prestation.",
    droit: "pos.vente.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ designation: string; reference: string | null; unite: string; quantite: string; ht: string; cout: string }>(sql`
        select coalesce(a.designation, lv.designation) as designation, a.reference, min(lv.unite) as unite,
               sum(lv.quantite) as quantite, sum(lv.montant_ht) as ht,
               round(sum(lv.quantite * lv.cout_unitaire)::numeric / 1000) + sum(lv.cout_main_oeuvre) as cout
        from lignes_vente lv
        join ventes v on v.id = lv.vente_id
        left join articles a on a.id = lv.article_id
        where v.organization_id = ${organizationId} and v.statut = 'encaissee'
          and ${JOUR_VENTE} between ${du}::date and ${au}::date
        group by lv.article_id, coalesce(a.designation, lv.designation), a.reference
        order by sum(lv.montant_ht) desc
      `);
      return {
        colonnes: [
          { cle: "reference", libelle: "Référence", type: "texte" },
          { cle: "designation", libelle: "Désignation", type: "texte" },
          { cle: "unite", libelle: "Unité", type: "texte" },
          { cle: "quantite", libelle: "Quantité", type: "quantite", total: false },
          { cle: "ht", libelle: "Ventes HT", type: "montant" },
          { cle: "cout", libelle: "Coût de revient", type: "montant" },
          { cle: "marge", libelle: "Marge", type: "montant" },
          { cle: "taux", libelle: "Taux de marge", type: "taux_bp", total: false },
        ],
        lignes: lignes.map((l) => {
          const ht = Number(l.ht);
          const cout = Number(l.cout);
          return {
            reference: l.reference,
            designation: l.designation,
            unite: l.unite,
            quantite: Number(l.quantite),
            ht,
            cout,
            marge: ht - cout,
            taux: ht > 0 ? divideMoney((ht - cout) * 10_000, ht) : null,
          };
        }),
        note: "Le coût de revient est celui enregistré au moment de la vente, main-d'œuvre des prestations comprise.",
      };
    },
  },
  {
    cle: "ventes-par-moyen",
    module: "pos",
    rubrique: "Ventes en caisse",
    titre: "Encaissements par moyen de paiement",
    description: "Espèces, mobile money, carte, virement : ce que la caisse a reçu par chaque moyen.",
    droit: "pos.vente.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ moyen: string; operations: string; montant: string }>(sql`
        select r.moyen, count(*) as operations, sum(r.montant) as montant
        from reglements_vente r join ventes v on v.id = r.vente_id
        where v.organization_id = ${organizationId} and v.statut = 'encaissee'
          and ${JOUR_VENTE} between ${du}::date and ${au}::date
        group by r.moyen order by sum(r.montant) desc
      `);
      return {
        colonnes: [
          { cle: "moyen", libelle: "Moyen", type: "texte" },
          { cle: "operations", libelle: "Paiements", type: "entier", total: true },
          { cle: "montant", libelle: "Montant", type: "montant" },
        ],
        lignes: lignes.map((l) => ({ moyen: MOYENS[l.moyen] ?? l.moyen, operations: Number(l.operations), montant: Number(l.montant) })),
      };
    },
  },
  {
    cle: "ventes-par-caissier",
    module: "pos",
    rubrique: "Ventes en caisse",
    titre: "Ventes par caissier",
    description: "Tickets, chiffre d'affaires et annulations de chaque caissier.",
    droit: "pos.vente.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ caissier: string | null; tickets: string; ttc: string; annulees: string }>(sql`
        select u.full_name as caissier,
               count(*) filter (where v.statut = 'encaissee') as tickets,
               coalesce(sum(v.total_ttc) filter (where v.statut = 'encaissee'), 0) as ttc,
               count(*) filter (where v.statut = 'annulee') as annulees
        from ventes v left join users u on u.id = v.user_id
        where v.organization_id = ${organizationId} and ${JOUR_VENTE} between ${du}::date and ${au}::date
        group by u.full_name order by 3 desc
      `);
      return {
        colonnes: [
          { cle: "caissier", libelle: "Caissier", type: "texte" },
          { cle: "tickets", libelle: "Tickets", type: "entier", total: true },
          { cle: "ttc", libelle: "Total TTC", type: "montant" },
          { cle: "panier", libelle: "Panier moyen", type: "montant", total: false },
          { cle: "annulees", libelle: "Tickets annulés", type: "entier", total: true },
        ],
        lignes: lignes.map((l) => ({
          caissier: l.caissier ?? "Inconnu",
          tickets: Number(l.tickets),
          ttc: Number(l.ttc),
          panier: divideMoney(Number(l.ttc), Number(l.tickets)),
          annulees: Number(l.annulees),
        })),
      };
    },
  },
];
