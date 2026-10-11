"use client";

import { Retour, useOperation } from "@/components/ui/operations";
import { installerCatalogueDepart } from "@/modules/boutique/actions";
import { FAMILLES_COMMERCE } from "@/modules/boutique/calcul";

/** Proposé tant que l'entreprise n'a aucune famille d'articles. */
export function CatalogueDepart() {
  const { resultat, enCours, lancer } = useOperation();
  return (
    <section className="mb-5 rounded-xl border border-dashed border-marque-400 bg-[var(--surface)] p-4">
      <h2 className="text-sm font-semibold">Ranger le catalogue par rayons</h2>
      <p className="mt-1 max-w-[75ch] text-sm text-[var(--encre-douce)]">
        Installe les familles d&apos;un commerce de détail — {FAMILLES_COMMERCE.map((f) => f.nom).join(", ")} — au taux de TVA de
        18 % et sur le compte des ventes de marchandises. Chaque famille se corrige ensuite ; un produit exonéré se règle
        sur sa fiche, avec votre comptable.
      </p>
      <button
        type="button"
        disabled={enCours}
        onClick={() => lancer(() => installerCatalogueDepart())}
        className="mt-3 h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
      >
        {enCours ? "Installation…" : "Installer les familles"}
      </button>
      <Retour resultat={resultat} />
    </section>
  );
}
