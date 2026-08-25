import type { Metadata } from "next";

import {
  BoutonPrincipal,
  EnTetePage,
  Pastille,
  Tableau,
  Td,
  Th,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmt, fmtEntier } from "@/lib/format";
import {
  LIBELLE_ETAT,
  LIBELLE_TYPE,
  RESSOURCES,
  type EtatRessource,
} from "@/lib/fixtures/reservations";

export const metadata: Metadata = { title: "Ressources" };

const TON: Record<EtatRessource, TonPastille> = {
  disponible: "valide",
  loue: "marque",
  maintenance: "alerte",
  retire: "neutre",
};

export default function PageRessources() {
  const parCategorie = new Map<string, typeof RESSOURCES>();
  for (const ressource of RESSOURCES) {
    const liste = parCategorie.get(ressource.categorie) ?? [];
    liste.push(ressource);
    parCategorie.set(ressource.categorie, liste);
  }

  return (
    <>
      <EnTetePage
        titre="Ressources"
        sousTitre="Catalogue de ce qui se loue, se réserve ou se met à disposition"
        actions={<BoutonPrincipal>Nouvelle ressource</BoutonPrincipal>}
      />

      <div className="space-y-5">
        {[...parCategorie.entries()].map(([categorie, liste]) => (
          <section key={categorie}>
            <h2 className="mb-2.5 text-base font-semibold">{categorie}</h2>

            <Tableau>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Désignation</Th>
                  <Th>Type</Th>
                  <Th>État</Th>
                  <Th aligne="droite">Parc</Th>
                  <Th aligne="droite">Jour</Th>
                  <Th aligne="droite">Semaine</Th>
                  <Th aligne="droite">Mois</Th>
                  <Th aligne="droite">Caution</Th>
                </tr>
              </thead>
              <tbody>
                {liste.map((ressource) => (
                  <tr key={ressource.id}>
                    <Td chiffres>{ressource.code}</Td>
                    <Td fort>{ressource.designation}</Td>
                    <Td>
                      <span className="text-xs text-[var(--encre-douce)]">
                        {LIBELLE_TYPE[ressource.type]}
                      </span>
                    </Td>
                    <Td>
                      <Pastille ton={TON[ressource.etat]}>
                        {LIBELLE_ETAT[ressource.etat]}
                      </Pastille>
                    </Td>
                    <Td aligne="droite" chiffres>
                      {fmtEntier(ressource.quantite)}
                    </Td>
                    {/* Toutes les durées ne sont pas servies : une salle de fête
                        se loue à la journée, jamais au mois. */}
                    <Td aligne="droite" chiffres>
                      {ressource.tarifJour ? fmt(ressource.tarifJour) : "—"}
                    </Td>
                    <Td aligne="droite" chiffres>
                      {ressource.tarifSemaine ? fmt(ressource.tarifSemaine) : "—"}
                    </Td>
                    <Td aligne="droite" chiffres>
                      {ressource.tarifMois ? fmt(ressource.tarifMois) : "—"}
                    </Td>
                    <Td aligne="droite" chiffres>
                      {fmt(ressource.caution)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tableau>
          </section>
        ))}
      </div>

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Au-delà d&apos;une semaine ou d&apos;un mois, le tarif bascule sur le
        forfait correspondant au lieu de multiplier le prix journalier. Sans cette
        dégressivité, une location d&apos;un mois reviendrait plus cher que le
        matériel lui-même.
      </p>
    </>
  );
}
