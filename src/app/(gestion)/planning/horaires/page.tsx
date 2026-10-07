import type { Metadata } from "next";

import { EnTetePage } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { minutesEnHeure } from "@/modules/planning/calcul";
import { horairesDe, membresPlanning } from "@/modules/planning/requetes";

import { ChoixMembre, EditeurHoraires } from "../composants";

export const metadata: Metadata = { title: "Horaires habituels" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La semaine type : quand on peut compter sur la personne, tant qu'aucun créneau ne dit autre chose. */
export default async function PageHoraires({ searchParams }: PageProps<"/planning/horaires">) {
  const session = await exigerEntreprise();
  const { pour } = await searchParams;
  const gere = await peut("planning.gerer");
  const membres = gere ? await membresPlanning(session.organizationId) : [];
  const autre = gere && typeof pour === "string" && UUID.test(pour) ? membres.find((m) => m.userId === pour && m.userId !== session.userId) : undefined;
  const cible = autre?.userId ?? session.userId;

  const plages = (await horairesDe(session.organizationId, [cible])).get(cible) ?? [];
  const initial: Record<number, { debut: string; fin: string }[]> = {};
  for (const p of plages) (initial[p.jour] ??= []).push({ debut: minutesEnHeure(p.debutMinutes), fin: p.finMinutes >= 1440 ? "23:59" : minutesEnHeure(p.finMinutes) });

  return (
    <>
      <EnTetePage
        titre={autre ? `Horaires de ${autre.nom}` : "Mes horaires habituels"}
        sousTitre="Pendant ces plages, vous êtes « Disponible » sauf si un créneau dit autre chose ; en dehors, « Hors horaires »."
        actions={gere ? <ChoixMembre membres={membres} actuel={cible} moi={session.userId} base="/planning/horaires" /> : undefined}
      />
      <EditeurHoraires key={cible} initial={initial} pourUserId={autre?.userId ?? null} />
    </>
  );
}
