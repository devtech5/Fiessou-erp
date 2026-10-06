import type { Metadata } from "next";

import { ListePrestations } from "@/components/prestataires/liste-prestations";
import { FormulairePrestation } from "@/components/prestataires/formulaires";
import { CarteIndicateur, EnTetePage } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtCompact, fmtEntier } from "@/lib/format";
import { compteParDefaut } from "@/modules/prestataires/calcul";
import { listerPrestataires, listerPrestations } from "@/modules/prestataires/creation";
import { comptesDisponibles } from "@/modules/tresorerie/actions";

export const metadata: Metadata = { title: "Prestations" };

/** Toutes les prestations confiées, de la demande au paiement. */
export default async function PagePrestations() {
  const session = await exigerEntreprise();
  const [liste, prestataires, gerer, payer] = await Promise.all([
    listerPrestations(session.organizationId),
    listerPrestataires(session.organizationId),
    peut("prestataires.gerer"),
    peut("prestataires.payer"),
  ]);
  const comptes = payer ? await comptesDisponibles() : [];
  const metierDe = new Map(prestataires.map((p) => [p.id, p.metiers[0]]));
  const enCours = liste.filter((x) => x.statut === "demandee" || x.statut === "confirmee").length;
  const aPayer = liste.filter((x) => x.statut === "realisee");
  const duMois = liste.filter((x) => x.payeeLe && x.payeeLe.toISOString().slice(0, 7) === new Date().toISOString().slice(0, 7));

  return (
    <>
      <EnTetePage
        titre="Prestations"
        sousTitre="Ce qui a été confié aux prestataires, de la demande au paiement"
        actions={gerer ? <FormulairePrestation prestataires={prestataires.filter((p) => p.disponible).map((p) => ({ id: p.id, nom: p.nom }))} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur libelle="En cours" valeur={fmtEntier(enCours)} precision="Demandées ou confirmées" />
        <CarteIndicateur libelle="Réalisées à payer" valeur={fmtEntier(aPayer.length)} ton={aPayer.length > 0 ? "alerte" : "valide"} precision={`${fmtCompact(aPayer.reduce((s, x) => s + (x.montantConvenu ?? 0), 0))} F convenus`} />
        <CarteIndicateur libelle="Payé ce mois" valeur={fmtCompact(duMois.reduce((s, x) => s + (x.montantPaye ?? 0), 0))} unite="FCFA" precision={`${duMois.length} prestation${duMois.length > 1 ? "s" : ""}`} />
        <CarteIndicateur libelle="Prestataires" valeur={fmtEntier(prestataires.length)} precision="Inscrits à l'annuaire" />
      </section>
      <ListePrestations
        prestations={liste.map((x) => ({ ...x, compteDefaut: compteParDefaut(metierDe.get(x.prestataireId)) }))}
        compteDefaut="621"
        comptes={comptes.map((c) => ({ id: c.id, nom: c.nom }))}
        peutGerer={gerer}
        peutPayer={payer}
        avecPrestataire
      />
    </>
  );
}
