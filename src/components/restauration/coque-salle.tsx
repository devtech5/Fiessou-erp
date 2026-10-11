import type { ReactNode } from "react";

import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";
import { DROITS_ESPACE, ESPACES, type Espace } from "@/modules/restauration/calcul";

/**
 * Coque commune au restaurant et au maquis : même garde, mêmes onglets, à
 * l'adresse de chaque espace.
 */
export async function CoqueSalle({ espace, children }: { espace: Espace; children: ReactNode }) {
  const definition = ESPACES[espace];
  if (!moduleOuvert(definition.module)) return <ModuleEnPreparation cle={definition.module} />;
  const droit = DROITS_ESPACE[espace].consulter;
  if (!(await peut(droit))) return <AccesRefuse droit={droit} />;

  const sections = [
    { href: definition.racine, libelle: "Salle" },
    { href: `${definition.racine}/production`, libelle: definition.cuisine === "Cuisine" ? "Cuisine et bar" : "Grill et bar" },
    { href: `${definition.racine}/tables`, libelle: "Tables et encaissement" },
  ];

  return (
    <>
      <SousNavigation entrees={sections} />
      {children}
    </>
  );
}
