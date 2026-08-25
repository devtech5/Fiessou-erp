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
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import {
  LIBELLE_OPERATION,
  NOM_RESEAU,
  OPERATIONS,
  totauxJournee,
  type TypeOperation,
} from "@/lib/fixtures/monnaie";

export const metadata: Metadata = { title: "Opérations" };

const TON: Record<TypeOperation, TonPastille> = {
  depot: "valide",
  retrait: "marque",
  credit: "neutre",
};

export default function PageOperations() {
  const t = totauxJournee();

  return (
    <>
      <EnTetePage
        titre="Opérations"
        sousTitre="Journal du jour · 25 août 2026"
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Opérations"
          valeur={fmtEntier(t.operations)}
          precision={`${t.nbDepots} dépôts · ${t.nbRetraits} retraits · ${t.nbCredits} crédits`}
        />
        <CarteIndicateur
          libelle="Volume déposé"
          valeur={fmtCompact(t.volumeDepots)}
          unite="FCFA"
          precision="Espèces reçues des clients"
        />
        <CarteIndicateur
          libelle="Volume retiré"
          valeur={fmtCompact(t.volumeRetraits)}
          unite="FCFA"
          precision="Espèces remises aux clients"
        />
        <CarteIndicateur
          libelle="Commissions"
          valeur={fmt(t.commissions)}
          unite="FCFA"
          ton="valide"
          precision="Recette réelle du guichet"
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Heure</Th>
            <Th>Opération</Th>
            <Th>Réseau</Th>
            <Th>Numéro</Th>
            <Th aligne="droite">Montant</Th>
            <Th aligne="droite">Commission</Th>
          </tr>
        </thead>
        <tbody>
          {OPERATIONS.map((operation) => (
            <tr key={operation.id}>
              <Td chiffres>{operation.heure}</Td>
              <Td>
                <Pastille ton={TON[operation.type]}>
                  {LIBELLE_OPERATION[operation.type]}
                </Pastille>
              </Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">
                  {NOM_RESEAU[operation.reseau]}
                </span>
              </Td>
              <Td chiffres>{operation.numero}</Td>
              <Td aligne="droite" chiffres fort>
                {fmt(operation.montant)}
              </Td>
              <Td aligne="droite" chiffres>
                <span className="text-valide-600">+ {fmt(operation.commission)}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        La commission est la seule recette du guichet. Les volumes déposés et
        retirés ne sont pas un chiffre d&apos;affaires : ils transitent, et leur
        somme doit se retrouver au franc près à la clôture.
      </p>
    </>
  );
}
