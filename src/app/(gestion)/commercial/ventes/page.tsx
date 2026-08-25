import type { Metadata } from "next";

import {
  BoutonPrincipal,
  BoutonSecondaire,
  CarteIndicateur,
  EnTetePage,
} from "@/components/ui/primitives";
import { fmtCompact, fmtEntier } from "@/lib/format";
import { DOCUMENTS, comptabilisable, totalTTC } from "@/lib/fixtures/gestion";
import { EcriturePiece } from "./ecriture-piece";

export const metadata: Metadata = { title: "Ventes" };

/**
 * Devis, factures et avoirs sur un seul écran.
 *
 * Ce sont trois états d'un même flux, pas trois métiers : un devis devient une
 * facture, une facture se corrige par un avoir. Les séparer en trois onglets
 * oblige à traverser l'application pour suivre une seule affaire.
 */
export default function PageVentes() {
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
  const aPasser = DOCUMENTS.filter((d) => comptabilisable(d) && !d.comptabiliseLe);

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

      <EcriturePiece />

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        L&apos;écriture est calculée à l&apos;affichage, jamais conservée à côté
        de la pièce : figée, elle divergerait de la facture au premier
        changement sans que rien ne le signale. Montants en francs CFA.
      </p>
    </>
  );
}
