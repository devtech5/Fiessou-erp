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
  ACTIFS,
  LIBELLE_STATUT,
  LIBELLE_TYPE,
  type StatutActif,
} from "@/lib/fixtures/actifs";

export const metadata: Metadata = { title: "Parc" };

const TON: Record<StatutActif, TonPastille> = {
  actif: "valide",
  entretien: "alerte",
  immobilise: "danger",
  cede: "neutre",
};

export default function PageParc() {
  const valeur = ACTIFS.reduce((s, a) => s + a.valeurAcquisition, 0);
  const maintenance = ACTIFS.reduce((s, a) => s + a.coutMaintenance, 0);
  const indisponibles = ACTIFS.filter(
    (a) => a.statut === "entretien" || a.statut === "immobilise",
  ).length;

  return (
    <>
      <EnTetePage
        titre="Parc"
        sousTitre="Véhicules, matériel informatique, engins et équipements"
        actions={<BoutonPrincipal>Nouvel actif</BoutonPrincipal>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Actifs suivis"
          valeur={fmtEntier(ACTIFS.length)}
          precision={`${ACTIFS.filter((a) => a.affecteA).length} affectés à une personne`}
        />
        <CarteIndicateur
          libelle="Valeur d'acquisition"
          valeur={fmtCompact(valeur)}
          unite="FCFA"
        />
        <CarteIndicateur
          libelle="Coût de maintenance"
          valeur={fmtCompact(maintenance)}
          unite="FCFA"
          precision={`${Math.round((maintenance / valeur) * 100)} % de la valeur du parc`}
        />
        <CarteIndicateur
          libelle="Indisponibles"
          valeur={fmtEntier(indisponibles)}
          ton={indisponibles > 0 ? "alerte" : "valide"}
          precision="En entretien ou immobilisés"
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Désignation</Th>
            <Th>Type</Th>
            <Th>Affecté à</Th>
            <Th>Site</Th>
            <Th>Statut</Th>
            <Th aligne="droite">Compteur</Th>
            <Th aligne="droite">Maintenance</Th>
          </tr>
        </thead>
        <tbody>
          {ACTIFS.map((actif) => (
            <tr key={actif.id}>
              <Td chiffres>{actif.code}</Td>
              <Td fort>{actif.designation}</Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">
                  {LIBELLE_TYPE[actif.type]}
                </span>
              </Td>
              <Td>
                {/* L'affectation pointe vers une personne du module Personnel,
                    salariée ou intervenante. */}
                {actif.affecteA ?? (
                  <span className="text-xs text-[var(--encre-faible)]">
                    Non affecté
                  </span>
                )}
              </Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">{actif.site}</span>
              </Td>
              <Td>
                <Pastille ton={TON[actif.statut]}>
                  {LIBELLE_STATUT[actif.statut]}
                </Pastille>
              </Td>
              <Td aligne="droite" chiffres>
                {actif.compteur !== undefined
                  ? `${fmtEntier(actif.compteur)} ${actif.uniteCompteur}`
                  : "—"}
              </Td>
              <Td aligne="droite" chiffres>
                {actif.coutMaintenance > 0 ? fmt(actif.coutMaintenance) : "—"}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </>
  );
}
