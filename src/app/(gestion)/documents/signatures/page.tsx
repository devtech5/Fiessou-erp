import type { Metadata } from "next";

import {
  BoutonPrincipal,
  CarteIndicateur,
  EnTetePage,
  Pastille,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmtEntier } from "@/lib/format";
import {
  LIBELLE_SIGNATURE,
  SIGNATURES,
  signatairesManquants,
  type StatutSignature,
} from "@/lib/fixtures/documents";

export const metadata: Metadata = { title: "Signatures" };

const TON: Record<StatutSignature, TonPastille> = {
  brouillon: "neutre",
  envoyee: "marque",
  partielle: "alerte",
  signee: "valide",
  expiree: "danger",
  annulee: "neutre",
};

/**
 * Demandes de signature.
 *
 * Une demande n'aboutit que lorsque TOUS les signataires ont signé : tant
 * qu'il en manque un, le document n'a aucune valeur, même partiellement signé.
 * L'écran affiche donc qui manque, pas seulement un pourcentage — on relance
 * une personne, pas une statistique.
 */
export default function PageSignatures() {
  const enAttente = SIGNATURES.filter(
    (s) => s.statut === "envoyee" || s.statut === "partielle",
  );
  const signees = SIGNATURES.filter((s) => s.statut === "signee");
  const expirees = SIGNATURES.filter((s) => s.statut === "expiree");

  return (
    <>
      <EnTetePage
        titre="Signatures"
        sousTitre="Demandes envoyées et documents signés"
        actions={<BoutonPrincipal>Demander une signature</BoutonPrincipal>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <CarteIndicateur
          libelle="En attente"
          valeur={fmtEntier(enAttente.length)}
          ton={enAttente.length > 0 ? "marque" : "valide"}
          precision="Signataires à relancer"
        />
        <CarteIndicateur
          libelle="Signées"
          valeur={fmtEntier(signees.length)}
          ton="valide"
          precision="Certificat disponible"
        />
        <CarteIndicateur
          libelle="Expirées"
          valeur={fmtEntier(expirees.length)}
          ton={expirees.length > 0 ? "danger" : "valide"}
          precision="À relancer depuis le début"
        />
      </section>

      <ul className="grid gap-2 lg:grid-cols-2">
        {SIGNATURES.map((demande) => {
          const manquants = signatairesManquants(demande);

          return (
            <li
              key={demande.id}
              className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="chiffres text-xs text-[var(--encre-faible)]">
                    {demande.reference}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {demande.document}
                  </p>
                </div>
                <Pastille ton={TON[demande.statut]}>
                  {LIBELLE_SIGNATURE[demande.statut]}
                </Pastille>
              </div>

              <ul className="mt-3 space-y-1.5">
                {demande.signataires.map((signataire, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        signataire.signeLe
                          ? "bg-valide-500 text-white"
                          : "bg-[var(--surface-creuse)] text-[var(--encre-faible)]"
                      }`}
                      aria-hidden
                    >
                      {signataire.signeLe ? "✓" : "·"}
                    </span>

                    <span className="min-w-0 flex-1 truncate">
                      {signataire.nom}
                      <span className="ml-1.5 text-xs text-[var(--encre-faible)]">
                        {signataire.interne ? "interne" : "externe"}
                      </span>
                    </span>

                    <span className="chiffres shrink-0 text-xs text-[var(--encre-faible)]">
                      {signataire.signeLe ?? "en attente"}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--filet)] pt-2.5 text-xs">
                <span className="chiffres text-[var(--encre-faible)]">
                  Expire le {demande.expireLe}
                </span>

                {/* Le code transmis de vive voix, hors du canal d'envoi, est ce
                    qui empêche un tiers ayant accès au message de signer. */}
                {demande.codeSecurite && (
                  <Pastille ton="marque">Code à 6 chiffres</Pastille>
                )}

                {manquants > 0 && demande.statut !== "expiree" && (
                  <span className="ml-auto font-semibold text-alerte-600">
                    {manquants} signature{manquants > 1 ? "s" : ""} manquante
                    {manquants > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Un document partiellement signé n&apos;engage personne. Tant qu&apos;un
        signataire manque, la demande reste ouverte et le certificat n&apos;est pas
        émis.
      </p>
    </>
  );
}
