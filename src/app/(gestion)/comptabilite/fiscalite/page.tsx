import type { Metadata } from "next";

import {
  CarteIndicateur,
  EnTetePage,
  Pastille,
  Tableau,
  Td,
  Th,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmt, fmtCompact } from "@/lib/format";
import {
  LIBELLE_OBLIGATION,
  OBLIGATIONS,
  type ObligationFiscale,
} from "@/lib/fixtures/comptabilite";

export const metadata: Metadata = { title: "Fiscalité" };

const TON: Record<ObligationFiscale["statut"], TonPastille> = {
  a_declarer: "marque",
  declaree: "neutre",
  payee: "valide",
  en_retard: "danger",
};

/**
 * Obligations fiscales et sociales — référentiel ivoirien.
 *
 * Les administrations sont la DGI et la CNPS. Le concurrent affiche sur ses
 * écrans vendus en Côte d'Ivoire la DGID, l'IPRES, la CSS, le TRIMF, la CFCE
 * et l'État 1024 : ce sont les organismes et déclarations du Sénégal. Un
 * commerçant d'Abidjan n'a rien à en faire.
 */
export default function PageFiscalite() {
  const aPayer = OBLIGATIONS.filter(
    (o) => o.statut === "a_declarer" || o.statut === "en_retard",
  );
  const retard = OBLIGATIONS.filter((o) => o.statut === "en_retard");
  const payees = OBLIGATIONS.filter((o) => o.statut === "payee");

  return (
    <>
      <EnTetePage
        titre="Fiscalité"
        sousTitre="Obligations déclaratives · DGI et CNPS"
      />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
        <CarteIndicateur
          libelle="À régler"
          valeur={fmtCompact(aPayer.reduce((s, o) => s + o.montant, 0))}
          unite="FCFA"
          precision={`${aPayer.length} obligations en cours`}
        />
        <CarteIndicateur
          libelle="En retard"
          valeur={fmtCompact(retard.reduce((s, o) => s + o.montant, 0))}
          unite="FCFA"
          ton={retard.length > 0 ? "danger" : "valide"}
          precision={
            retard.length > 0
              ? `${retard.length} échéance dépassée`
              : "Aucune échéance dépassée"
          }
        />
        <CarteIndicateur
          libelle="Réglé sur l'exercice"
          valeur={fmtCompact(payees.reduce((s, o) => s + o.montant, 0))}
          unite="FCFA"
          ton="valide"
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Obligation</Th>
            <Th>Administration</Th>
            <Th>Période</Th>
            <Th>Échéance</Th>
            <Th>Statut</Th>
            <Th aligne="droite">Montant</Th>
          </tr>
        </thead>
        <tbody>
          {OBLIGATIONS.map((obligation) => (
            <tr key={obligation.id}>
              <Td fort>{obligation.libelle}</Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">
                  {obligation.administration}
                </span>
              </Td>
              <Td>{obligation.periode}</Td>
              <Td chiffres>
                <span
                  className={
                    obligation.statut === "en_retard" ? "font-semibold text-danger-600" : ""
                  }
                >
                  {obligation.echeance}
                </span>
              </Td>
              <Td>
                <Pastille ton={TON[obligation.statut]}>
                  {LIBELLE_OBLIGATION[obligation.statut]}
                </Pastille>
              </Td>
              <Td aligne="droite" chiffres fort>
                {fmt(obligation.montant)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        La déclaration de TVA du mois écoulé est préparée automatiquement à partir
        des écritures. Une déclaration marquée comme déclarée ou payée verrouille
        la période : plus aucune écriture ne peut y être ajoutée ou modifiée.
      </p>
    </>
  );
}
