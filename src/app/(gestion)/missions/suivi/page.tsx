import type { Metadata } from "next";

import { EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { etapesDeMission, listerMissions } from "@/modules/missions/requetes";

import { FilMission } from "./fil-mission";

export const metadata: Metadata = { title: "Suivi terrain" };

export default async function PageSuivi({
  searchParams,
}: {
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>;
}) {
  const session = await exigerEntreprise();
  const demande = (await searchParams).mission;

  const [missions, peutSaisir, peutGerer] = await Promise.all([
    listerMissions(session.organizationId),
    peut("missions.terrain.saisir"),
    peut("missions.mission.gerer"),
  ]);

  // Par défaut, la première mission ouverte : c'est celle qu'on attend du
  // terrain. À défaut, la plus récente.
  const choisie =
    missions.find((m) => m.id === demande) ??
    missions.find((m) => m.statut === "en_cours" || m.statut === "planifiee") ??
    missions[0] ??
    null;

  const etapes = choisie
    ? await etapesDeMission(session.organizationId, choisie.id)
    : [];

  return (
    <>
      <EnTetePage
        titre="Suivi terrain"
        sousTitre="Étapes et preuves rapportées du terrain"
      />
      {missions.length === 0 ? (
        <EtatVide
          titre="Rien à suivre"
          message="Ouvrez une mission : ses étapes et leurs preuves apparaîtront ici, au fil de ce que le terrain rapporte."
        />
      ) : (
        <FilMission
          missions={missions}
          selectionId={choisie?.id ?? null}
          etapes={etapes}
          peutSaisir={peutSaisir}
          peutGerer={peutGerer}
        />
      )}
    </>
  );
}
