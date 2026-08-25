import type { Metadata } from "next";

import {
  BoutonPrincipal,
  BoutonSecondaire,
  CarteIndicateur,
  EnTetePage,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmtCompact, fmtEntier } from "@/lib/format";
import { DOCUMENTS, comptabilisable, totalTTC } from "@/lib/fixtures/gestion";
import { piecesComptabilisees } from "@/modules/comptabilite/actions";
import { listerDepots } from "@/modules/stock/requetes";
import {
  derniersTickets,
  journeeCaisse,
  listerPostes,
} from "@/modules/ventes/requetes";
import { EcriturePiece } from "./ecriture-piece";
import { TicketsCaisse } from "./tickets-caisse";

export const metadata: Metadata = { title: "Ventes" };

/**
 * Devis, factures et avoirs sur un seul écran.
 *
 * Ce sont trois états d'un même flux, pas trois métiers : un devis devient une
 * facture, une facture se corrige par un avoir. Les séparer en trois onglets
 * oblige à traverser l'application pour suivre une seule affaire.
 */
export default async function PageVentes() {
  const session = await exigerEntreprise();

  // Le début de journée sert de borne à la clôture : c'est la période que le
  // caissier compte le soir, tiroir ouvert.
  const debutJournee = new Date();
  debutJournee.setHours(0, 0, 0, 0);

  // L'état comptable vient de la base : c'est l'écriture enregistrée qui
  // fait foi, pas un drapeau posé à côté de la pièce.
  const [passees, tickets, journee, postes, depots] = await Promise.all([
    piecesComptabilisees(),
    derniersTickets(session.organizationId, 25),
    journeeCaisse(session.organizationId, debutJournee),
    listerPostes(session.organizationId),
    listerDepots(session.organizationId),
  ]);

  const factures = DOCUMENTS.filter((d) => d.nature === "facture");
  const devis = DOCUMENTS.filter((d) => d.nature === "devis");

  const encaisse = factures
    .filter((f) => f.statut === "paye")
    .reduce((somme, f) => somme + totalTTC(f), 0);
  const retard = factures.filter((f) => f.statut === "en_retard");

  // Taux de transformation : la mesure qui dit si le commercial travaille.
  const convertis = devis.filter((d) => d.statut === "converti").length;
  const taux = devis.length > 0 ? Math.round((convertis / devis.length) * 100) : 0;

  // Pièces qui engagent l'entreprise mais n'ont pas encore d'écriture. C'est
  // l'écart entre ce que le commerce a vendu et ce que la comptabilité sait.
  const aPasser = DOCUMENTS.filter((d) => comptabilisable(d) && !passees[d.numero]);

  return (
    <>
      <EnTetePage
        titre="Ventes"
        sousTitre="Devis, factures et avoirs"
        actions={
          <>
            <BoutonSecondaire>Exporter</BoutonSecondaire>
            <BoutonPrincipal>Nouvelle facture</BoutonPrincipal>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Encaissé"
          valeur={fmtCompact(encaisse)}
          unite="FCFA"
          ton="valide"
        />
        <CarteIndicateur
          libelle="En retard"
          valeur={fmtCompact(retard.reduce((s, f) => s + totalTTC(f), 0))}
          unite="FCFA"
          ton={retard.length > 0 ? "danger" : "valide"}
          precision={`${retard.length} facture${retard.length > 1 ? "s" : ""} à relancer`}
        />
        <CarteIndicateur
          libelle="Devis transformés"
          valeur={`${taux}`}
          unite="%"
          precision={`${convertis} sur ${devis.length} devis émis`}
        />
        <CarteIndicateur
          libelle="À comptabiliser"
          valeur={fmtEntier(aPasser.length)}
          ton={aPasser.length > 0 ? "alerte" : "valide"}
          precision="Pièces sans écriture"
        />
      </section>

      <TicketsCaisse
        tickets={tickets}
        journee={journee}
        postes={postes.map((poste) => ({
          code: poste.code,
          nom: poste.nom,
          depotNom: poste.depotNom,
          dernierNumero: poste.dernierNumero,
        }))}
        depots={depots.map((depot) => ({ id: depot.id, nom: depot.nom }))}
      />

      <h2 className="mb-2.5 text-base font-semibold">Pièces commerciales</h2>
      <EcriturePiece passees={passees} />

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Les encaissements de caisse viennent de la base : chaque ticket a sorti
        son stock et posé son écriture dans la même transaction. Les devis et
        factures ci-dessus restent des pièces de démonstration, en attendant
        leur module. L&apos;écriture y est calculée à l&apos;affichage, jamais
        conservée à côté de la pièce : figée, elle divergerait de la facture au
        premier changement sans que rien ne le signale.
      </p>
    </>
  );
}
