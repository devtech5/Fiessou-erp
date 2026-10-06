import type { Metadata } from "next";

import { AccesRefuse } from "@/components/coque/acces-refuse";
import { FormulaireReglages, GestionFeries } from "@/components/presences/formulaires";
import { EnTetePage } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { jourLocal } from "@/modules/presences/calcul";
import { reglagesDe } from "@/modules/presences/creation";
import { listerFeries } from "@/modules/presences/requetes";

export const metadata: Metadata = { title: "Réglages des présences" };

export default async function PageReglagesPresences() {
  if (!(await peut("presences.gerer"))) return <AccesRefuse droit="presences.gerer" />;
  const session = await exigerEntreprise();
  const r = await reglagesDe(session.organizationId);
  const annee = Number(jourLocal(new Date(), r.fuseau).slice(0, 4));
  const feries = await listerFeries(session.organizationId, annee);

  return (
    <>
      <EnTetePage titre="Réglages des présences" sousTitre="Horaires, jours travaillés, règle des congés et jours fériés" />
      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <FormulaireReglages r={r} />
        <GestionFeries feries={feries.map((f) => ({ id: f.id, jour: f.jour, libelle: f.libelle }))} annee={annee} />
      </div>
    </>
  );
}
