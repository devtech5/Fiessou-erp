import type { Metadata } from "next";

import {
  BoutonPrincipal,
  BoutonSecondaire,
  CarteIndicateur,
  EnTetePage,
  Pastille,
  Tableau,
  Td,
  Th,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmt, fmtCompact } from "@/lib/format";
import { DOCUMENTS, LIBELLE_STATUT, type StatutDocument } from "@/lib/fixtures/gestion";

export const metadata: Metadata = { title: "Ventes" };

const TON: Record<StatutDocument, TonPastille> = {
  brouillon: "neutre",
  envoye: "marque",
  paye: "valide",
  en_retard: "danger",
  accepte: "valide",
  refuse: "danger",
  converti: "valide",
};

const NATURE = { facture: "Facture", devis: "Devis", avoir: "Avoir" } as const;

/**
 * Devis, factures et avoirs dans un seul écran.
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
    .reduce((somme, f) => somme + f.montant, 0);
  const attendu = factures
    .filter((f) => f.statut === "envoye" || f.statut === "en_retard")
    .reduce((somme, f) => somme + f.montant, 0);
  const retard = factures.filter((f) => f.statut === "en_retard");
  const reglees = factures.filter((f) => f.statut === "paye").length;

  // Taux de transformation : la mesure qui dit si le commercial travaille.
  const convertis = devis.filter((d) => d.statut === "converti").length;
  const taux = devis.length > 0 ? Math.round((convertis / devis.length) * 100) : 0;

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
          precision={`${reglees} facture${reglees > 1 ? "s réglées" : " réglée"}`}
        />
        <CarteIndicateur
          libelle="En attente"
          valeur={fmtCompact(attendu)}
          unite="FCFA"
          precision="Factures émises non réglées"
        />
        <CarteIndicateur
          libelle="En retard"
          valeur={fmtCompact(retard.reduce((s, f) => s + f.montant, 0))}
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
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Numéro</Th>
            <Th>Nature</Th>
            <Th>Client</Th>
            <Th>Date</Th>
            <Th>Échéance</Th>
            <Th>Statut</Th>
            <Th aligne="droite">Montant</Th>
          </tr>
        </thead>
        <tbody>
          {DOCUMENTS.map((doc) => (
            <tr key={doc.id}>
              <Td chiffres fort>
                {doc.numero}
              </Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">
                  {NATURE[doc.nature]}
                </span>
              </Td>
              <Td>{doc.client}</Td>
              <Td chiffres>{doc.date}</Td>
              <Td chiffres>
                <span className={doc.statut === "en_retard" ? "text-danger-600" : ""}>
                  {doc.echeance ?? "—"}
                </span>
              </Td>
              <Td>
                <Pastille ton={TON[doc.statut]}>{LIBELLE_STATUT[doc.statut]}</Pastille>
              </Td>
              <Td aligne="droite" chiffres fort>
                {/* Un avoir vient en diminution : il s'affiche en négatif. */}
                {doc.nature === "avoir" ? `− ${fmt(doc.montant)}` : fmt(doc.montant)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>

      <p className="mt-4 text-xs text-[var(--encre-faible)]">
        Montants en francs CFA.
      </p>
    </>
  );
}
