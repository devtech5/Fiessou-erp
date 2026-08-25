import type { Metadata } from "next";

import {
  BoutonPrincipal,
  CarteIndicateur,
  EnTetePage,
} from "@/components/ui/primitives";
import { fmtEntier } from "@/lib/format";
import { DOCUMENTS } from "@/lib/fixtures/documents";
import { Bibliotheque } from "./bibliotheque";

export const metadata: Metadata = { title: "Documents" };

export default function PageDocuments() {
  const expirants = DOCUMENTS.filter(
    (d) => d.joursAvantExpiration !== undefined && d.joursAvantExpiration <= 30,
  );
  const prives = DOCUMENTS.filter((d) => d.visibilite === "prive");
  const rattaches = new Set(DOCUMENTS.map((d) => d.entite)).size;

  return (
    <>
      <EnTetePage
        titre="Documents"
        sousTitre="Pièces rattachées aux clients, employés, actifs et contrats"
        actions={<BoutonPrincipal>Ajouter un document</BoutonPrincipal>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <CarteIndicateur
          libelle="Documents"
          valeur={fmtEntier(DOCUMENTS.length)}
          precision={`Rattachés à ${rattaches} types d'entités`}
        />
        <CarteIndicateur
          libelle="Bientôt expirés"
          valeur={fmtEntier(expirants.length)}
          ton={expirants.length > 0 ? "alerte" : "valide"}
          precision="Assurances, agréments, visites"
        />
        <CarteIndicateur
          libelle="À accès privé"
          valeur={fmtEntier(prives.length)}
          precision="Pièces personnelles et RH"
        />
      </section>

      <Bibliotheque />

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Un document se range par ce à quoi il se rattache, pas dans une
        arborescence de dossiers. Un contrat qui concerne à la fois un client et
        un véhicule n&apos;a pas à choisir son dossier : il répond à la seule
        question posée devant l&apos;écran — quelles pièces ai-je sur ce client,
        ce véhicule, cet employé.
      </p>
    </>
  );
}
