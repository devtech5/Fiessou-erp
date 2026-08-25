import type { Metadata } from "next";

import {
  BoutonPrincipal,
  CarteIndicateur,
  EnTetePage,
  Pastille,
} from "@/components/ui/primitives";
import { fmtEntier } from "@/lib/format";
import { FORMULAIRES, LIBELLE_CHAMP } from "@/lib/fixtures/missions";

export const metadata: Metadata = { title: "Formulaires" };

/**
 * Formulaires de collecte.
 *
 * C'est l'usage qui exige le plus le fonctionnement hors connexion. Un
 * enquêteur en zone rurale, un livreur dans un sous-sol ou un chef de chantier
 * derrière un mur de béton saisissent sans réseau. Le compteur « en attente »
 * dit combien de réponses dorment encore sur des appareils — ne pas l'afficher
 * revient à croire une collecte terminée alors qu'elle n'est pas remontée.
 */
export default function PageFormulaires() {
  const collectees = FORMULAIRES.reduce((s, f) => s + f.reponses, 0);
  const enAttente = FORMULAIRES.reduce((s, f) => s + f.enAttente, 0);

  return (
    <>
      <EnTetePage
        titre="Formulaires"
        sousTitre="Saisie de terrain, fonctionne sans réseau"
        actions={<BoutonPrincipal>Nouveau formulaire</BoutonPrincipal>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <CarteIndicateur
          libelle="Formulaires actifs"
          valeur={fmtEntier(FORMULAIRES.length)}
        />
        <CarteIndicateur
          libelle="Réponses remontées"
          valeur={fmtEntier(collectees)}
          ton="valide"
        />
        <CarteIndicateur
          libelle="Encore sur les appareils"
          valeur={fmtEntier(enAttente)}
          ton={enAttente > 0 ? "alerte" : "valide"}
          precision="Saisies hors connexion"
        />
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {FORMULAIRES.map((formulaire) => (
          <section
            key={formulaire.id}
            className="flex flex-col rounded-xl border border-[var(--filet)] bg-[var(--surface)]"
          >
            <header className="border-b border-[var(--filet)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{formulaire.nom}</h2>
                  <p className="text-xs text-[var(--encre-faible)]">
                    {formulaire.usage}
                  </p>
                </div>
                {formulaire.enAttente > 0 && (
                  <Pastille ton="alerte">{formulaire.enAttente}</Pastille>
                )}
              </div>

              <p className="chiffres mt-2 text-lg font-bold">
                {fmtEntier(formulaire.reponses)}
                <span className="ml-1.5 text-xs font-medium text-[var(--encre-faible)]">
                  réponses
                </span>
              </p>
            </header>

            <ul className="flex-1 divide-y divide-[var(--filet)] p-1">
              {formulaire.champs.map((champ, index) => (
                <li
                  key={index}
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
          </section>
        ))}
      </div>

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Un formulaire téléchargé sur un appareil reste utilisable sans réseau. Les
        réponses, photos et positions sont horodatées à la saisie, pas à la
        remontée — c&apos;est l&apos;heure du terrain qui fait foi, pas celle de la
        synchronisation.
      </p>
    </>
  );
}
