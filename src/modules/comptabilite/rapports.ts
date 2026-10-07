import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";


export const RAPPORTS_COMPTABILITE: DefinitionRapport[] = [
  {
    cle: "balance-generale",
    module: "comptabilite",
    rubrique: "Comptabilité",
    titre: "Balance générale",
    description: "Mouvements et solde de chaque compte du plan SYSCOHADA sur la période.",
    droit: "comptabilite.ecriture.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{ compte: string; libelle: string; debit: string; credit: string }>(sql`
        select l.compte, min(l.libelle_compte) as libelle, sum(l.debit) as debit, sum(l.credit) as credit
        from lignes_ecriture l join ecritures e on e.id = l.ecriture_id
        where l.organization_id = ${organizationId} and e.origine <> 'cloture'
          and e.date_ecriture between ${du}::date and ${au}::date
        group by l.compte order by l.compte
      `);
      return {
        colonnes: [
          { cle: "compte", libelle: "Compte", type: "texte" },
          { cle: "libelle", libelle: "Intitulé", type: "texte" },
          { cle: "debit", libelle: "Débit", type: "montant" },
          { cle: "credit", libelle: "Crédit", type: "montant" },
          { cle: "solde_debiteur", libelle: "Solde débiteur", type: "montant" },
          { cle: "solde_crediteur", libelle: "Solde créditeur", type: "montant" },
        ],
        lignes: lignes.map((l) => {
          const solde = Number(l.debit) - Number(l.credit);
          return {
            compte: l.compte,
            libelle: l.libelle,
            debit: Number(l.debit),
            credit: Number(l.credit),
            solde_debiteur: solde > 0 ? solde : null,
            solde_crediteur: solde < 0 ? -solde : null,
          };
        }),
        note: "Une balance juste a le même total au débit et au crédit. L'écriture de clôture est exclue.",
      };
    },
  },
  {
    cle: "journal-general",
    module: "comptabilite",
    rubrique: "Comptabilité",
    titre: "Journal général",
    description: "Toutes les écritures de la période, ligne par ligne, avec leur pièce d'origine.",
    droit: "comptabilite.ecriture.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        date: string | Date;
        journal: string;
        numero: string;
        piece: string;
        libelle: string;
        compte: string;
        auxiliaire: string | null;
        debit: string;
        credit: string;
      }>(sql`
        select e.date_ecriture as date, e.journal, e.numero, e.piece_numero as piece, e.libelle, l.compte, l.auxiliaire, l.debit, l.credit
        from lignes_ecriture l join ecritures e on e.id = l.ecriture_id
        where l.organization_id = ${organizationId} and e.date_ecriture between ${du}::date and ${au}::date
        order by e.date_ecriture, e.journal, e.numero, l.ordre
        limit 20000
      `);
      return {
        colonnes: [
          { cle: "date", libelle: "Date", type: "date" },
          { cle: "journal", libelle: "Jnl", type: "texte" },
          { cle: "numero", libelle: "Écriture", type: "texte" },
          { cle: "piece", libelle: "Pièce", type: "texte" },
          { cle: "libelle", libelle: "Libellé", type: "texte" },
          { cle: "compte", libelle: "Compte", type: "texte" },
          { cle: "auxiliaire", libelle: "Auxiliaire", type: "texte" },
          { cle: "debit", libelle: "Débit", type: "montant" },
          { cle: "credit", libelle: "Crédit", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          ...l,
          date: jourIso(l.date),
          debit: Number(l.debit) || null,
          credit: Number(l.credit) || null,
        })),
      };
    },
  },
];
