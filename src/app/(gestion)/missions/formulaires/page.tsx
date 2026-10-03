import type { Metadata } from "next";

import { CarteIndicateur, EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtEntier } from "@/lib/format";
import { listerFormulaires } from "@/modules/missions/requetes";

import { NouveauFormulaire, RepondreFormulaire } from "./formulaires-terrain";

export const metadata: Metadata = { title: "Formulaires" };

const LIBELLE_CHAMP = {
  texte: "Texte",
  nombre: "Nombre",
  choix: "Liste",
  photo: "Photo",
  position: "Position",
  oui_non: "Oui / Non",
} as const;

/**
 * Formulaires de collecte.
 *
 * C'est l'usage qui exige le plus le fonctionnement hors connexion. Un
 * enquêteur en zone rurale, un livreur dans un sous-sol ou un chef de chantier
 * derrière un mur de béton saisissent sans réseau. La saisie passe par la file
 * de l'appareil : une réponse n'est jamais perdue faute de couverture.
 */
export default async function PageFormulaires() {
  const session = await exigerEntreprise();

  const [formulaires, peutComposer, peutSaisir] = await Promise.all([
    listerFormulaires(session.organizationId),
    peut("missions.formulaire.gerer"),
    peut("missions.terrain.saisir"),
  ]);

  const collectees = formulaires.reduce((somme, f) => somme + f.reponses, 0);

  return (
    <>
      <EnTetePage
        titre="Formulaires"
        sousTitre="Saisie de terrain, fonctionne sans réseau"
        actions={peutComposer ? <NouveauFormulaire /> : undefined}
      />

      {formulaires.length === 0 ? (
        <EtatVide
          titre="Aucun formulaire"
          message="Un formulaire décrit ce que le terrain doit relever : enseigne, gérant, photo de la devanture, position. Composez-le une fois, il se remplit ensuite depuis n'importe quel téléphone."
        />
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2">
            <CarteIndicateur
              libelle="Formulaires actifs"
              valeur={fmtEntier(formulaires.length)}
            />
            <CarteIndicateur
              libelle="Réponses remontées"
              valeur={fmtEntier(collectees)}
              ton="valide"
              precision="Reçues par le serveur"
            />
          </section>

          <div className="grid gap-3 lg:grid-cols-3">
            {formulaires.map((formulaire) => (
              <section
                key={formulaire.id}
                className="flex flex-col rounded-xl border border-[var(--filet)] bg-[var(--surface)]"
              >
                <header className="border-b border-[var(--filet)] p-4">
                  <h2 className="truncate text-sm font-semibold">{formulaire.nom}</h2>
                  {formulaire.usage && (
                    <p className="text-xs text-[var(--encre-faible)]">{formulaire.usage}</p>
                  )}
                  <p className="chiffres mt-2 text-lg font-bold">
                    {fmtEntier(formulaire.reponses)}
                    <span className="ml-1.5 text-xs font-medium text-[var(--encre-faible)]">
                      réponses
                    </span>
                  </p>
                </header>

                <ul className="flex-1 divide-y divide-[var(--filet)] p-1">
                  {formulaire.champs.map((champ) => (
                    <li
                      key={champ.cle}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {champ.libelle}
                        {champ.obligatoire && (
                          <span
                            className="ml-1 text-danger-600"
                            title="Champ obligatoire"
                            aria-label="obligatoire"
                          >
                            *
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--encre-faible)]">
                        {LIBELLE_CHAMP[champ.type]}
                      </span>
                    </li>
                  ))}
                </ul>

                {peutSaisir && (
                  <RepondreFormulaire formulaireId={formulaire.id} champs={formulaire.champs} />
                )}
              </section>
            ))}
          </div>
        </>
      )}

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Les réponses sont horodatées à la saisie, pas à la remontée — c&apos;est
        l&apos;heure du terrain qui fait foi, pas celle de la synchronisation.
      </p>
    </>
  );
}
