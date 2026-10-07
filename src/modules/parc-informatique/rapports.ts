import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { jourIso, type DefinitionRapport } from "@/lib/rapports/types";

import { CATEGORIES_EQUIPEMENT, etatLicence, type CleCategorie, type EtatLicence } from "./calcul";

const ETATS_LICENCE: Record<EtatLicence, string> = {
  conforme: "Conforme",
  depassee: "Postes dépassés",
  expire_bientot: "Expire bientôt",
  expiree: "Expirée",
};

export const RAPPORTS_PARC_INFORMATIQUE: DefinitionRapport[] = [
  {
    cle: "inventaire-informatique",
    module: "parc_informatique",
    rubrique: "Parc informatique",
    titre: "Inventaire par catégorie",
    description: "Portables, postes fixes, imprimantes, réseau : combien, dans quel état, et pour quelle valeur d'achat à la date choisie.",
    droit: "parc_informatique.consulter",
    periode: "situation",
    async executer(organizationId, { au }) {
      const lignes = await db.execute<{
        categorie: CleCategorie;
        nombre: string;
        en_service: string;
        entretien: string;
        affectes: string;
        valeur: string;
      }>(sql`
        select q.categorie, count(*) as nombre,
               count(*) filter (where a.statut = 'actif') as en_service,
               count(*) filter (where a.statut in ('entretien', 'immobilise')) as entretien,
               count(*) filter (where a.employe_id is not null or a.intervenant_id is not null) as affectes,
               coalesce(sum(a.valeur_acquisition), 0) as valeur
        from equipements_informatiques q join actifs a on a.id = q.actif_id
        where q.organization_id = ${organizationId} and q.deleted_at is null and a.deleted_at is null
          and a.statut <> 'cede' and (a.date_acquisition is null or a.date_acquisition <= ${au}::date)
        group by q.categorie
        order by count(*) desc
      `);
      return {
        colonnes: [
          { cle: "categorie", libelle: "Catégorie", type: "texte" },
          { cle: "nombre", libelle: "Équipements", type: "entier", total: true },
          { cle: "en_service", libelle: "En service", type: "entier", total: true },
          { cle: "entretien", libelle: "En panne ou immobilisés", type: "entier", total: true },
          { cle: "affectes", libelle: "Affectés à une personne", type: "entier", total: true },
          { cle: "valeur", libelle: "Valeur d'acquisition", type: "montant" },
        ],
        lignes: lignes.map((l) => ({
          categorie: CATEGORIES_EQUIPEMENT[l.categorie] ?? l.categorie,
          nombre: Number(l.nombre),
          en_service: Number(l.en_service),
          entretien: Number(l.entretien),
          affectes: Number(l.affectes),
          valeur: Number(l.valeur),
        })),
        note: "Les équipements cédés sont sortis de l'inventaire. L'état est celui d'aujourd'hui ; la date ne filtre que les acquisitions.",
      };
    },
  },
  {
    cle: "licences-logicielles",
    module: "parc_informatique",
    rubrique: "Parc informatique",
    titre: "Licences logicielles",
    description: "Chaque licence : postes achetés et utilisés, date de fin, coût, et ce qui est dépassé ou arrive à expiration.",
    droit: "parc_informatique.consulter",
    periode: "situation",
    async executer(organizationId, { au }) {
      const lignes = await db.execute<{
        logiciel: string;
        editeur: string | null;
        type: "abonnement" | "perpetuelle";
        postes: number;
        utilises: string;
        expire_le: string | Date | null;
        cout: string;
      }>(sql`
        select l.logiciel, l.editeur, l.type, l.postes, l.expire_le, l.cout,
               (select count(*) from licences_attribuees x join actifs a on a.id = x.actif_id
                 where x.licence_id = l.id and x.deleted_at is null and a.deleted_at is null and a.statut <> 'cede') as utilises
        from licences_logicielles l
        where l.organization_id = ${organizationId} and l.deleted_at is null
        order by l.expire_le nulls last, l.logiciel
      `);
      return {
        colonnes: [
          { cle: "logiciel", libelle: "Logiciel", type: "texte" },
          { cle: "editeur", libelle: "Éditeur", type: "texte" },
          { cle: "type", libelle: "Type", type: "texte" },
          { cle: "postes", libelle: "Postes achetés", type: "entier", total: true },
          { cle: "utilises", libelle: "Postes utilisés", type: "entier", total: true },
          { cle: "expire_le", libelle: "Fin de validité", type: "date" },
          { cle: "etat", libelle: "État", type: "texte" },
          { cle: "cout", libelle: "Coût", type: "montant" },
        ],
        lignes: lignes.map((l) => {
          const expireLe = l.expire_le === null ? null : jourIso(l.expire_le);
          const { etat } = etatLicence({ postes: Number(l.postes), utilises: Number(l.utilises), expireLe }, au);
          return {
            logiciel: l.logiciel,
            editeur: l.editeur,
            type: l.type === "abonnement" ? "Abonnement" : "Perpétuelle",
            postes: Number(l.postes),
            utilises: Number(l.utilises),
            expire_le: expireLe,
            etat: ETATS_LICENCE[etat],
            cout: Number(l.cout),
          };
        }),
        note: "L'état se lit à la date choisie : une licence qui expire dans les trente jours est signalée.",
      };
    },
  },
];
