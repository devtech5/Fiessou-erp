import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import type { DefinitionRapport } from "@/lib/rapports/types";

/** Les mouvements se datent à l'heure d'Abidjan, comme les ventes. */
const JOUR_MOUVEMENT = sql`(m.effectue_le at time zone 'Africa/Abidjan')::date`;

export const RAPPORTS_STOCK: DefinitionRapport[] = [
  {
    cle: "valorisation-stock",
    module: "stock",
    rubrique: "Stock",
    titre: "Valorisation du stock",
    description: "Quantité en stock, coût moyen et valeur de chaque article à la date choisie, tous dépôts confondus.",
    droit: "stock.article.consulter",
    periode: "situation",
    async executer(organizationId, { au }) {
      const lignes = await db.execute<{ reference: string; designation: string; unite: string; quantite: string; valeur: string }>(sql`
        select a.reference, a.designation, a.unite, sum(m.quantite) as quantite,
               round(sum(m.quantite * m.cout_unitaire)::numeric / 1000) as valeur
        from mouvements_stock m join articles a on a.id = m.article_id
        where m.organization_id = ${organizationId} and m.deleted_at is null and ${JOUR_MOUVEMENT} <= ${au}::date
        group by a.id, a.reference, a.designation, a.unite
        having sum(m.quantite) <> 0
        order by a.designation
      `);
      return {
        colonnes: [
          { cle: "reference", libelle: "Référence", type: "texte" },
          { cle: "designation", libelle: "Désignation", type: "texte" },
          { cle: "unite", libelle: "Unité", type: "texte" },
          { cle: "quantite", libelle: "Quantité", type: "quantite", total: false },
          { cle: "cout", libelle: "Coût moyen", type: "montant", total: false },
          { cle: "valeur", libelle: "Valeur", type: "montant" },
        ],
        lignes: lignes.map((l) => {
          const quantite = Number(l.quantite);
          const valeur = Number(l.valeur);
          // Coût par unité entière : la quantité est en millièmes.
          return { reference: l.reference, designation: l.designation, unite: l.unite, quantite, cout: divideMoney(valeur * 1000, quantite), valeur };
        }),
        note: "Valeur au coût d'entrée enregistré sur chaque mouvement. Les quantités ne s'additionnent pas entre articles d'unités différentes.",
      };
    },
  },
  {
    cle: "mouvements-stock-par-article",
    module: "stock",
    rubrique: "Stock",
    titre: "Entrées et sorties par article",
    description: "Ce qui est entré et sorti de chaque article sur la période, et la variation qui en résulte.",
    droit: "stock.article.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ reference: string; designation: string; unite: string; entrees: string; sorties: string; mouvements: string }>(sql`
        select a.reference, a.designation, a.unite,
               coalesce(sum(m.quantite) filter (where m.quantite > 0), 0) as entrees,
               coalesce(-sum(m.quantite) filter (where m.quantite < 0), 0) as sorties,
               count(*) as mouvements
        from mouvements_stock m join articles a on a.id = m.article_id
        where m.organization_id = ${organizationId} and m.deleted_at is null
          and ${JOUR_MOUVEMENT} between ${du}::date and ${au}::date
        group by a.id, a.reference, a.designation, a.unite
        order by a.designation
      `);
      return {
        colonnes: [
          { cle: "reference", libelle: "Référence", type: "texte" },
          { cle: "designation", libelle: "Désignation", type: "texte" },
          { cle: "unite", libelle: "Unité", type: "texte" },
          { cle: "entrees", libelle: "Entrées", type: "quantite", total: false },
          { cle: "sorties", libelle: "Sorties", type: "quantite", total: false },
          { cle: "variation", libelle: "Variation", type: "quantite", total: false },
          { cle: "mouvements", libelle: "Mouvements", type: "entier", total: true },
        ],
        lignes: lignes.map((l) => ({
          reference: l.reference,
          designation: l.designation,
          unite: l.unite,
          entrees: Number(l.entrees),
          sorties: Number(l.sorties),
          variation: Number(l.entrees) - Number(l.sorties),
          mouvements: Number(l.mouvements),
        })),
        note: "Un transfert entre dépôts compte une sortie et une entrée.",
      };
    },
  },
];
