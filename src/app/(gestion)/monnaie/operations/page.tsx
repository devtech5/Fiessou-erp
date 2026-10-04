import type { Metadata } from "next";

import {
  CarteIndicateur,
  EnTetePage,
  EtatVide,
  Pastille,
  Tableau,
  Td,
  Th,
  type TonPastille,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import { LIBELLE_OPERATION, NOM_RESEAU } from "@/modules/monnaie/calcul";
import { guichetOuvert } from "@/modules/monnaie/requetes";
import type { TypeOperationGuichet } from "@/modules/monnaie/schema";

import { AnnulationOperation } from "./annulation-operation";

export const metadata: Metadata = { title: "Opérations" };

const TON: Record<TypeOperationGuichet, TonPastille> = {
  depot: "valide",
  retrait: "marque",
  credit: "neutre",
  approvisionnement: "alerte",
  destockage: "alerte",
};

const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * Journal de la session ouverte. Les volumes déposés et retirés ne sont pas
 * un chiffre d'affaires : ils transitent. La commission est la seule recette.
 */
export default async function PageOperations() {
  const session = await exigerEntreprise();
  const [guichet, annuler] = await Promise.all([
    guichetOuvert(session.organizationId),
    peut("valeur_electronique.operation.annuler"),
  ]);

  if (!guichet) {
    return (
      <>
        <EnTetePage titre="Opérations" sousTitre="Journal de la session" />
        <EtatVide titre="Guichet fermé" message="Ouvrez une session dans l'onglet Guichet pour enregistrer des opérations." />
      </>
    );
  }

  const valides = guichet.operations.filter((o) => !o.annulee);
  const somme = (type: TypeOperationGuichet) =>
    valides.filter((o) => o.type === type).reduce((s, o) => s + o.montant, 0);
  const nombre = (type: TypeOperationGuichet) => valides.filter((o) => o.type === type).length;

  return (
    <>
      <EnTetePage titre="Opérations" sousTitre={`Journal de la session ${guichet.session.numero}`} />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2">
        <CarteIndicateur
          libelle="Opérations"
          valeur={fmtEntier(valides.length)}
          precision={`${nombre("depot")} dépôts · ${nombre("retrait")} retraits · ${nombre("credit")} crédits`}
        />
        <CarteIndicateur libelle="Volume déposé" valeur={fmtCompact(somme("depot"))} unite="FCFA" precision="Espèces reçues des clients" />
        <CarteIndicateur libelle="Volume retiré" valeur={fmtCompact(somme("retrait"))} unite="FCFA" precision="Espèces remises aux clients" />
        <CarteIndicateur
          libelle="Commissions"
          valeur={fmt(guichet.soldes.commissions)}
          unite="FCFA"
          ton="valide"
          precision="Recette du guichet, due par les opérateurs"
        />
      </section>

      {guichet.operations.length === 0 ? (
        <EtatVide titre="Aucune opération" message="Les dépôts, retraits et ventes de crédit de la session s'afficheront ici." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Heure</Th>
              <Th>Numéro</Th>
              <Th>Opération</Th>
              <Th>Réseau</Th>
              <Th>Client</Th>
              <Th aligne="droite">Montant</Th>
              <Th aligne="droite">Commission</Th>
              {annuler && <Th aligne="droite"> </Th>}
            </tr>
          </thead>
          <tbody>
            {guichet.operations.map((o) => (
              <tr key={o.id} className={o.annulee ? "opacity-60" : undefined}>
                <Td chiffres>{HEURE.format(o.le)}</Td>
                <Td chiffres>
                  {o.numero}
                  {o.referenceOperateur && (
                    <span className="block text-xs text-[var(--encre-faible)]">{o.referenceOperateur}</span>
                  )}
                </Td>
                <Td>
                  <Pastille ton={o.annulee ? "neutre" : TON[o.type]}>{LIBELLE_OPERATION[o.type]}</Pastille>
                  {o.annulee && <span className="block text-xs text-[var(--encre-faible)]">Annulée : {o.motif}</span>}
                </Td>
                <Td>
                  <span className="text-xs text-[var(--encre-douce)]">{NOM_RESEAU[o.reseau]}</span>
                </Td>
                <Td chiffres>{o.telephone ?? "—"}</Td>
                <Td aligne="droite" chiffres fort>
                  {o.annulee ? <span className="line-through">{fmt(o.montant)}</span> : fmt(o.montant)}
                </Td>
                <Td aligne="droite" chiffres>
                  {o.commission > 0 ? <span className="text-valide-600">+ {fmt(o.commission)}</span> : "—"}
                </Td>
                {annuler && <Td aligne="droite">{!o.annulee && <AnnulationOperation id={o.id} numero={o.numero} />}</Td>}
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Annuler une opération corrige le journal, pas le compte du client chez l&apos;opérateur : si
        l&apos;envoi est parti, il se rattrape par une opération inverse.
      </p>
    </>
  );
}
