import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";

import { STATUTS_PRESTATION, type StatutPrestation } from "./calcul";

export const RAPPORTS_PRESTATAIRES: DefinitionRapport[] = [
  {
    cle: "prestations-par-prestataire",
    module: "prestataires",
    rubrique: "Prestataires",
    titre: "Prestations payées par prestataire",
    description: "Plombiers, électriciens, transporteurs : prestations payées sur la période, montant versé, retenues et note moyenne.",
    droit: "prestataires.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        nom: string;
        metiers: string;
        formel: boolean;
        prestations: string;
        paye: string;
        retenue: string;
        notes: string;
        somme_notes: string | null;
      }>(sql`
        select t.nom, array_to_string(p.metiers, ', ') as metiers, p.formel, count(*) as prestations,
               coalesce(sum(s.montant_paye), 0) as paye, coalesce(sum(s.retenue), 0) as retenue,
               count(s.note) as notes, sum(s.note) as somme_notes
        from prestations s
        join prestataires p on p.id = s.prestataire_id
        join tiers t on t.id = p.tiers_id
        where s.organization_id = ${organizationId} and s.deleted_at is null and s.statut = 'payee'
          and (s.payee_le at time zone 'Africa/Abidjan')::date between ${du}::date and ${au}::date
        group by p.id, t.nom, p.metiers, p.formel
        order by sum(s.montant_paye) desc, t.nom
      `);
      return {
        colonnes: [
          { cle: "nom", libelle: "Prestataire", type: "texte" },
          { cle: "metiers", libelle: "Métiers", type: "texte" },
          { cle: "regime", libelle: "Régime", type: "texte" },
          { cle: "prestations", libelle: "Prestations", type: "entier", total: true },
          { cle: "paye", libelle: "Montant des prestations", type: "montant" },
          { cle: "retenue", libelle: "Retenue à la source", type: "montant" },
          { cle: "net", libelle: "Net versé", type: "montant" },
          // Millièmes : 4 333 se lit « 4,333 » sur 5.
          { cle: "note", libelle: "Note moyenne sur 5", type: "quantite", total: false },
        ],
        lignes: lignes.map((l) => ({
          nom: l.nom,
          metiers: l.metiers,
          regime: l.formel ? "Formel" : "Informel",
          prestations: Number(l.prestations),
          paye: Number(l.paye),
          retenue: Number(l.retenue),
          net: Number(l.paye) - Number(l.retenue),
          note: Number(l.notes) > 0 ? divideMoney(Number(l.somme_notes) * 1000, Number(l.notes)) : null,
        })),
        note: "La retenue à la source reste due à l'État (compte 447) : elle se reverse avec les autres impôts retenus.",
      };
    },
  },
  {
    cle: "prestations-a-payer",
    module: "prestataires",
    rubrique: "Prestataires",
    titre: "Prestations en attente de paiement",
    description: "Ce qui est commandé ou réalisé et pas encore payé à la date choisie : l'engagement envers les prestataires.",
    droit: "prestataires.consulter",
    periode: "situation",
    async executer(organizationId, { au }) {
      const lignes = await db.execute<{
        numero: string;
        nom: string;
        objet: string;
        statut: StatutPrestation;
        prevue_le: string | Date | null;
        realisee_le: string | Date | null;
        montant: string | null;
      }>(sql`
        select s.numero, t.nom, s.objet, s.statut, s.prevue_le,
               (s.realisee_le at time zone 'Africa/Abidjan')::date as realisee_le, s.montant_convenu as montant
        from prestations s
        join prestataires p on p.id = s.prestataire_id
        join tiers t on t.id = p.tiers_id
        where s.organization_id = ${organizationId} and s.deleted_at is null
          and s.statut in ('confirmee', 'realisee')
          and (s.created_at at time zone 'Africa/Abidjan')::date <= ${au}::date
        order by s.statut desc, coalesce(s.realisee_le::date, s.prevue_le), s.numero
      `);
      return {
        colonnes: [
          { cle: "numero", libelle: "N°", type: "texte" },
          { cle: "nom", libelle: "Prestataire", type: "texte" },
          { cle: "objet", libelle: "Objet", type: "texte" },
          { cle: "statut", libelle: "État", type: "texte" },
          { cle: "prevue_le", libelle: "Prévue le", type: "date" },
          { cle: "realisee_le", libelle: "Réalisée le", type: "date" },
          { cle: "montant", libelle: "Montant convenu", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          numero: l.numero,
          nom: l.nom,
          objet: l.objet,
          statut: STATUTS_PRESTATION[l.statut] ?? l.statut,
          prevue_le: l.prevue_le === null ? null : jourIso(l.prevue_le),
          realisee_le: l.realisee_le === null ? null : jourIso(l.realisee_le),
          montant: l.montant === null ? null : Number(l.montant),
        })),
        note: "Les prestations réalisées viennent en tête : le travail est fait, le prestataire attend son argent. L'état est celui d'aujourd'hui.",
      };
    },
  },
];
