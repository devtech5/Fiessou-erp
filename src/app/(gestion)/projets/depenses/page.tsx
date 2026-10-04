import type { Metadata } from "next";

import { CarteIndicateur, EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtCompact, fmtEntier } from "@/lib/format";
import { listerDepenses, listerProjets, piecesParDepense } from "@/modules/projets/requetes";
import { listerTiers } from "@/modules/tiers/requetes";

import { FormulaireDepense } from "../formulaire-depense";
import { TableauDepenses } from "../tableau-depenses";

export const metadata: Metadata = { title: "Dépenses" };

/**
 * Toutes les dépenses de l'entreprise, rattachées à un projet ou non. Celles
 * qui attendent une décision remontent en tête.
 */
export default async function PageDepenses() {
  const session = await exigerEntreprise();
  const [depenses, pieces, projets, fournisseurs, approuver, payer, demander] = await Promise.all([
    listerDepenses(session.organizationId),
    piecesParDepense(session.organizationId),
    listerProjets(session.organizationId),
    listerTiers(session.organizationId, "fournisseur"),
    peut("depense.approuver"),
    peut("depense.payer"),
    peut("depense.demander"),
  ]);

  const somme = (statut: string) => depenses.filter((d) => d.statut === statut).reduce((s, d) => s + d.montant, 0);
  const demandes = depenses.filter((d) => d.statut === "demandee").length;
  const sansPreuve = depenses.filter((d) => d.statut === "payee" && d.preuves === 0).length;
  const ouverts = projets.filter((p) => p.statut !== "termine" && p.statut !== "annule");

  return (
    <>
      <EnTetePage
        titre="Dépenses"
        sousTitre="De la demande au paiement, avec la preuve"
        actions={
          demander ? (
            <FormulaireDepense
              projets={ouverts.map((p) => ({ id: p.id, libelle: `${p.code} · ${p.nom}` }))}
              fournisseurs={fournisseurs.map((f) => ({ id: f.id, nom: f.nom }))}
            />
          ) : undefined
        }
      />

      {depenses.length === 0 ? (
        <EtatVide
          titre="Aucune dépense"
          message="Une dépense se demande, s'approuve par un autre responsable, puis se paie — preuve à l'appui. L'écriture passe au paiement."
        />
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CarteIndicateur
              libelle="À approuver"
              valeur={fmtCompact(somme("demandee"))}
              unite="FCFA"
              ton={somme("demandee") > 0 ? "alerte" : "valide"}
              precision={`${demandes} demande${demandes > 1 ? "s" : ""}`}
            />
            <CarteIndicateur libelle="Approuvé, à payer" valeur={fmtCompact(somme("approuvee"))} unite="FCFA" ton="marque" />
            <CarteIndicateur libelle="Payé" valeur={fmtCompact(somme("payee"))} unite="FCFA" ton="valide" />
            <CarteIndicateur
              libelle="Payées sans preuve"
              valeur={fmtEntier(sansPreuve)}
              ton={sansPreuve > 0 ? "danger" : "valide"}
              precision="Reçu ou capture à joindre"
            />
          </section>

          <TableauDepenses depenses={depenses} pieces={pieces} droits={{ approuver, payer, demander }} afficherProjet />
        </>
      )}
    </>
  );
}
