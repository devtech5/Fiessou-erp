import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { divideMoney } from "@/lib/money";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";

import { ETATS_CONVENTION, etatConvention, STATUTS_SOUMISSION, TYPES_MARCHE, type StatutSoumission } from "./calcul";

const SENS: Record<string, string> = { client: "Client", fournisseur: "Fournisseur", partenariat: "Partenariat" };

export const RAPPORTS_MARCHES: DefinitionRapport[] = [
  {
    cle: "soumissions-bilan",
    module: "marches",
    rubrique: "Marchés et conventions",
    titre: "Bilan des soumissions",
    description: "Offres déposées sur la période, par type de marché : gagnées, perdues, en attente, taux de succès et montants.",
    droit: "marches.consulter",
    periode: "intervalle",
    async executer(organizationId, { du, au }) {
      const lignes = await db.execute<{
        type: keyof typeof TYPES_MARCHE;
        deposees: string;
        gagnees: string;
        perdues: string;
        attente: string;
        propose: string;
        gagne: string;
      }>(sql`
        select s.type, count(*) as deposees,
               count(*) filter (where s.statut = 'gagnee') as gagnees,
               count(*) filter (where s.statut = 'perdue') as perdues,
               count(*) filter (where s.statut = 'deposee') as attente,
               coalesce(sum(s.montant_propose), 0) as propose,
               coalesce(sum(s.montant_propose) filter (where s.statut = 'gagnee'), 0) as gagne
        from soumissions s
        where s.organization_id = ${organizationId} and s.deleted_at is null and s.deposee_le is not null
          and (s.deposee_le at time zone 'Africa/Abidjan')::date between ${du}::date and ${au}::date
        group by s.type
        order by count(*) desc
      `);
      return {
        colonnes: [
          { cle: "type", libelle: "Type de marché", type: "texte" },
          { cle: "deposees", libelle: "Déposées", type: "entier", total: true },
          { cle: "gagnees", libelle: "Gagnées", type: "entier", total: true },
          { cle: "perdues", libelle: "Perdues", type: "entier", total: true },
          { cle: "attente", libelle: "En attente", type: "entier", total: true },
          { cle: "succes", libelle: "Taux de succès", type: "taux_bp", total: false },
          { cle: "propose", libelle: "Montant proposé", type: "montant" },
          { cle: "gagne", libelle: "Montant gagné", type: "montant" },
        ],
        lignes: lignes.map((l) => {
          const gagnees = Number(l.gagnees);
          const tranchees = gagnees + Number(l.perdues);
          return {
            type: TYPES_MARCHE[l.type] ?? l.type,
            deposees: Number(l.deposees),
            gagnees,
            perdues: Number(l.perdues),
            attente: Number(l.attente),
            succes: tranchees > 0 ? divideMoney(gagnees * 10_000, tranchees) : null,
            propose: Number(l.propose),
            gagne: Number(l.gagne),
          };
        }),
        note: "Le taux de succès ne retient que les soumissions dont le résultat est connu. Une offre abandonnée après dépôt compte parmi les déposées.",
      };
    },
  },
  {
    cle: "cautions-soumission",
    module: "marches",
    rubrique: "Marchés et conventions",
    titre: "Cautions de soumission à récupérer",
    description: "Les cautions déposées avec une offre et pas encore restituées : l'argent immobilisé auprès des autorités contractantes.",
    droit: "marches.consulter",
    periode: "situation",
    async executer(organizationId, { au }) {
      const lignes = await db.execute<{
        numero: string;
        intitule: string;
        autorite: string;
        statut: StatutSoumission;
        deposee_le: string | Date;
        caution: string;
      }>(sql`
        select s.numero, s.intitule, s.autorite, s.statut,
               (s.deposee_le at time zone 'Africa/Abidjan')::date as deposee_le, s.caution
        from soumissions s
        where s.organization_id = ${organizationId} and s.deleted_at is null
          and s.caution > 0 and not s.caution_restituee
          and s.deposee_le is not null and (s.deposee_le at time zone 'Africa/Abidjan')::date <= ${au}::date
        order by s.deposee_le, s.numero
      `);
      return {
        colonnes: [
          { cle: "numero", libelle: "N°", type: "texte" },
          { cle: "intitule", libelle: "Marché", type: "texte" },
          { cle: "autorite", libelle: "Autorité contractante", type: "texte" },
          { cle: "statut", libelle: "Résultat", type: "texte" },
          { cle: "deposee_le", libelle: "Déposée le", type: "date" },
          { cle: "caution", libelle: "Caution", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          numero: l.numero,
          intitule: l.intitule,
          autorite: l.autorite,
          statut: STATUTS_SOUMISSION[l.statut] ?? l.statut,
          deposee_le: jourIso(l.deposee_le),
          caution: Number(l.caution),
        })),
        note: "Une offre perdue doit voir sa caution restituée : c'est la première ligne à réclamer.",
      };
    },
  },
  {
    cle: "conventions-echeancier",
    module: "marches",
    rubrique: "Marchés et conventions",
    titre: "Échéancier des conventions",
    description: "Contrats clients, fournisseurs et partenariats non résiliés : fin effective avenants compris, préavis et montant en vigueur.",
    droit: "marches.consulter",
    periode: "situation",
    async executer(organizationId, { au }) {
      const conventions = await db.execute<{
        numero: string;
        intitule: string;
        sens: string;
        partenaire: string;
        debut: string | Date;
        fin: string | Date | null;
        reconduction_tacite: boolean;
        preavis_jours: number;
        resiliee_le: string | Date | null;
        montant: string | null;
        fins_avenants: (string | Date | null)[] | null;
        montant_avenant: string | null;
      }>(sql`
        select c.numero, c.intitule, c.sens, c.partenaire, c.debut, c.fin, c.reconduction_tacite, c.preavis_jours,
               c.resiliee_le, c.montant,
               (select array_agg(a.nouvelle_fin) from avenants a where a.convention_id = c.id and a.deleted_at is null) as fins_avenants,
               (select a.nouveau_montant from avenants a where a.convention_id = c.id and a.deleted_at is null
                  and a.nouveau_montant is not null and a.signe_le <= ${au}::date order by a.rang desc limit 1) as montant_avenant
        from conventions c
        where c.organization_id = ${organizationId} and c.deleted_at is null
          and (c.resiliee_le is null or c.resiliee_le > ${au}::date)
      `);
      const lignes = conventions
        .map((c) => {
          const { etat, fin, jours } = etatConvention(
            {
              debut: jourIso(c.debut),
              fin: c.fin === null ? null : jourIso(c.fin),
              reconductionTacite: c.reconduction_tacite,
              preavisJours: Number(c.preavis_jours),
              resilieeLe: c.resiliee_le === null ? null : jourIso(c.resiliee_le),
            },
            (c.fins_avenants ?? []).map((f) => (f === null ? null : jourIso(f))),
            au,
          );
          const montant = c.montant_avenant ?? c.montant;
          return {
            numero: c.numero,
            intitule: c.intitule,
            sens: SENS[c.sens] ?? c.sens,
            partenaire: c.partenaire,
            fin,
            jours: jours !== null && etat !== "a_venir" ? jours : null,
            etat: ETATS_CONVENTION[etat],
            montant: montant === null ? null : Number(montant),
          };
        })
        .sort((a, b) => (a.fin ?? "9999").localeCompare(b.fin ?? "9999"));
      return {
        colonnes: [
          { cle: "numero", libelle: "N°", type: "texte" },
          { cle: "intitule", libelle: "Convention", type: "texte" },
          { cle: "sens", libelle: "Sens", type: "texte" },
          { cle: "partenaire", libelle: "Partenaire", type: "texte" },
          { cle: "fin", libelle: "Fin effective", type: "date" },
          { cle: "jours", libelle: "Jours restants", type: "entier", total: false },
          { cle: "etat", libelle: "État", type: "texte" },
          { cle: "montant", libelle: "Montant en vigueur", type: "montant" },
        ],
        lignes,
        note: "« À renouveler » : la fin tombe dans le délai de préavis. Une reconduction tacite repousse la fin d'année en année.",
      };
    },
  },
];
