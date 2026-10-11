import Link from "next/link";

import { EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { DROITS_ESPACE, ESPACES, enRetard, minutesDepuis, type Espace, type Poste } from "@/modules/restauration/calcul";
import { bonsDeProduction } from "@/modules/restauration/requetes";

import { BonsProduction, type BonVue } from "./bons-production";
import { Rafraichissement } from "./rafraichissement";

/**
 * Écran de la cuisine et du bar : les bons dans l'ordre d'arrivée, ce qui est
 * en retard en tête de lecture, un geste pour dire « prêt ».
 *
 * Se relit toutes les dix secondes : un bon envoyé depuis la salle doit
 * apparaître avant que le serveur soit revenu au passe.
 */
export async function EcranProduction({ espace, filtre }: { espace: Espace; filtre?: string }) {
  const session = await exigerEntreprise();
  const definition = ESPACES[espace];
  const poste: Poste | undefined = filtre === "cuisine" || filtre === "bar" ? filtre : undefined;
  const [bons, preparer, prendre] = await Promise.all([
    bonsDeProduction(session.organizationId, espace, poste),
    peut(DROITS_ESPACE[espace].preparer),
    peut(DROITS_ESPACE[espace].prendre),
  ]);

  const maintenant = new Date();
  const vues: BonVue[] = bons.map((bon) => ({
    commandeId: bon.commandeId,
    numero: bon.numero,
    repere: bon.repere,
    lignes: bon.lignes.map((l) => ({
      id: l.id,
      designation: l.designation,
      quantite: l.quantite,
      unite: l.unite,
      note: l.note,
      poste: l.poste,
      etat: l.etat,
      minutes: minutesDepuis(l.envoyeeLe, maintenant),
      retard: enRetard(l, maintenant),
    })),
  }));
  const aPreparer = vues.reduce((s, b) => s + b.lignes.filter((l) => l.etat === "envoyee").length, 0);

  const filtres = [
    { cle: undefined, libelle: "Tout" },
    { cle: "cuisine", libelle: definition.cle === "maquis" ? "Grill et cuisine" : "Cuisine" },
    { cle: "bar", libelle: "Bar" },
  ] as const;

  return (
    <>
      <Rafraichissement secondes={10} />
      <EnTetePage
        titre={poste === "bar" ? "Bar" : poste === "cuisine" ? filtres[1].libelle : definition.cuisine === "Cuisine" ? "Cuisine et bar" : "Grill et bar"}
        sousTitre={aPreparer === 0 ? "Rien en préparation" : `${aPreparer} ligne${aPreparer > 1 ? "s" : ""} en préparation`}
      />
      <nav className="mb-4 flex gap-1.5" aria-label="Poste de préparation">
        {filtres.map((f) => (
          <Link
            key={f.libelle}
            href={f.cle ? `${definition.racine}/production?poste=${f.cle}` : `${definition.racine}/production`}
            aria-current={poste === f.cle ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              poste === f.cle ? "border-marque-600 bg-marque-600 text-white" : "border-[var(--filet)] hover:bg-[var(--surface-creuse)]"
            }`}
          >
            {f.libelle}
          </Link>
        ))}
      </nav>

      {vues.length === 0 ? (
        <EtatVide titre="Aucun bon" message="Les commandes envoyées depuis la salle apparaissent ici, dans l'ordre d'arrivée." />
      ) : (
        <BonsProduction espace={espace} bons={vues} peutPreparer={preparer} peutServir={prendre || preparer} />
      )}
    </>
  );
}
