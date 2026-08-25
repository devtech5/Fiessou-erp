import type { Metadata } from "next";

import {
  BoutonPrincipal,
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
  INTERVENTIONS,
  LIBELLE_NATURE,
  type NatureIntervention,
} from "@/lib/fixtures/actifs";

export const metadata: Metadata = { title: "Interventions" };

const TON: Record<NatureIntervention, TonPastille> = {
  preventif: "valide",
  correctif: "alerte",
  controle: "marque",
};

/**
 * Historique des interventions.
 *
 * Le même écran couvre deux situations que rien n'oblige à séparer :
 * l'entretien d'un actif de l'entreprise, qui est une charge, et l'intervention
 * sur l'actif d'un client, qui est facturable. C'est ce qui permet au moteur de
 * porter aussi bien un parc automobile qu'un garage.
 */
export default function PageInterventions() {
  const interne = INTERVENTIONS.filter((i) => !i.client);
  const facturable = INTERVENTIONS.filter((i) => i.client);

  const coutInterne = interne.reduce((s, i) => s + i.cout, 0);
  const produitFacturable = facturable.reduce((s, i) => s + i.cout, 0);
  const correctifs = INTERVENTIONS.filter((i) => i.nature === "correctif").length;

  return (
    <>
      <EnTetePage
        titre="Interventions"
        sousTitre="Entretien du parc et travaux facturés aux clients"
        actions={<BoutonPrincipal>Nouvelle intervention</BoutonPrincipal>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Interventions"
          valeur={fmtEntier(INTERVENTIONS.length)}
          precision={`${interne.length} sur le parc · ${facturable.length} clients`}
        />
        <CarteIndicateur
          libelle="Charge d'entretien"
          valeur={fmtCompact(coutInterne)}
          unite="FCFA"
          precision="Actifs de l'entreprise"
        />
        <CarteIndicateur
          libelle="Travaux facturables"
          valeur={fmtCompact(produitFacturable)}
          unite="FCFA"
          ton="valide"
          precision="Actifs appartenant à des clients"
        />
        <CarteIndicateur
          libelle="Correctifs"
          valeur={fmtEntier(correctifs)}
          ton={correctifs > interne.length / 2 ? "alerte" : "valide"}
          precision="Pannes plutôt que prévention"
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Actif</Th>
            <Th>Nature</Th>
            <Th>Intervention</Th>
            <Th>Prestataire</Th>
            <Th aligne="droite">Compteur</Th>
            <Th aligne="droite">Coût</Th>
          </tr>
        </thead>
        <tbody>
          {INTERVENTIONS.map((intervention) => (
            <tr key={intervention.id}>
              <Td chiffres>{intervention.date}</Td>
              <Td fort>
                {intervention.actif}
                {intervention.client && (
                  <span className="mt-0.5 block">
                    <Pastille ton="valide">Facturable · {intervention.client}</Pastille>
                  </span>
                )}
              </Td>
              <Td>
                <Pastille ton={TON[intervention.nature]}>
                  {LIBELLE_NATURE[intervention.nature]}
                </Pastille>
              </Td>
              <Td>{intervention.libelle}</Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">
                  {intervention.prestataire}
                </span>
              </Td>
              <Td aligne="droite" chiffres>
                {intervention.compteur !== undefined
                  ? fmtEntier(intervention.compteur)
                  : "—"}
              </Td>
              <Td aligne="droite" chiffres fort>
                <span className={intervention.client ? "text-valide-600" : ""}>
                  {fmt(intervention.cout)}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </>
  );
}
