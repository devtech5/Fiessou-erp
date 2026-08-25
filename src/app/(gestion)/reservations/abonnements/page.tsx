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
} from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import {
  ABONNEMENTS,
  LIBELLE_PERIODICITE,
  seancesRestantes,
} from "@/lib/fixtures/reservations";

export const metadata: Metadata = { title: "Abonnements" };

/**
 * Abonnements et adhésions.
 *
 * Deux régimes cohabitent et se traitent différemment :
 *
 *   · au forfait — l'accès est illimité sur une période, seule la date de fin
 *     compte ;
 *   · à la séance — un capital se consomme, et c'est le solde qui compte, pas
 *     la date.
 *
 * Un adhérent au forfait dont l'abonnement expire demain et un adhérent à la
 * séance dont il reste zéro entrée sont tous deux bloqués à l'accueil, mais
 * pour des raisons opposées. Les confondre, c'est refuser l'entrée à quelqu'un
 * qui a payé.
 */
export default function PageAbonnements() {
  const actifs = ABONNEMENTS.length;
  const epuises = ABONNEMENTS.filter((a) => {
    const reste = seancesRestantes(a);
    return reste !== null && reste <= 0;
  });
  const presqueEpuises = ABONNEMENTS.filter((a) => {
    const reste = seancesRestantes(a);
    return reste !== null && reste > 0 && reste <= 2;
  });
  const recettes = ABONNEMENTS.reduce((s, a) => s + a.montant, 0);

  return (
    <>
      <EnTetePage
        titre="Abonnements"
        sousTitre="Adhérents, formules et consommation"
        actions={
          <>
            <BoutonSecondaire>Borne d&apos;accueil</BoutonSecondaire>
            <BoutonPrincipal>Nouvel adhérent</BoutonPrincipal>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur libelle="Adhérents actifs" valeur={fmtEntier(actifs)} />
        <CarteIndicateur
          libelle="Crédits épuisés"
          valeur={fmtEntier(epuises.length)}
          ton={epuises.length > 0 ? "danger" : "valide"}
          precision="Accès refusé à l'accueil"
        />
        <CarteIndicateur
          libelle="Bientôt épuisés"
          valeur={fmtEntier(presqueEpuises.length)}
          ton={presqueEpuises.length > 0 ? "alerte" : "valide"}
          precision="Deux séances ou moins"
        />
        <CarteIndicateur
          libelle="Recettes"
          valeur={fmtCompact(recettes)}
          unite="FCFA"
          ton="valide"
          precision="Abonnements en cours"
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Adhérent</Th>
            <Th>Formule</Th>
            <Th>Régime</Th>
            <Th>Période</Th>
            <Th aligne="droite">Consommé</Th>
            <Th aligne="droite">Reste</Th>
            <Th>Dernière venue</Th>
            <Th aligne="droite">Montant</Th>
          </tr>
        </thead>
        <tbody>
          {ABONNEMENTS.map((abonnement) => {
            const reste = seancesRestantes(abonnement);
            const illimite = reste === null;

            return (
              <tr key={abonnement.id}>
                {/* Code adhérent au format deux lettres + deux chiffres :
                    assez court pour être annoncé de vive voix à l'accueil. */}
                <Td chiffres fort>
                  {abonnement.codeAdherent}
                </Td>
                <Td fort>{abonnement.nom}</Td>
                <Td>{abonnement.formule}</Td>
                <Td>
                  <span className="text-xs text-[var(--encre-douce)]">
                    {LIBELLE_PERIODICITE[abonnement.periodicite]}
                  </span>
                </Td>
                <Td chiffres>
                  <span className="text-xs">
                    {abonnement.debut} → {abonnement.fin}
                  </span>
                </Td>
                <Td aligne="droite" chiffres>
                  {fmtEntier(abonnement.seancesConsommees)}
                </Td>
                <Td aligne="droite">
                  {illimite ? (
                    <Pastille ton="valide">Illimité</Pastille>
                  ) : reste <= 0 ? (
                    <Pastille ton="danger">Épuisé</Pastille>
                  ) : reste <= 2 ? (
                    <Pastille ton="alerte">{reste}</Pastille>
                  ) : (
                    <span className="chiffres">{reste}</span>
                  )}
                </Td>
                <Td>
                  <span className="text-xs text-[var(--encre-douce)]">
                    {abonnement.derniereVenue}
                  </span>
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmt(abonnement.montant)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Tableau>
    </>
  );
}
