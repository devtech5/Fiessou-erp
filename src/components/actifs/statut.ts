import type { TonPastille } from "@/components/ui/primitives";
import type { StatutActif } from "@/modules/actifs/schema";

/** État de service d'un actif, tel que l'affichent les parcs. */
export const STATUT_ACTIF: Record<StatutActif, { libelle: string; ton: TonPastille }> = {
  actif: { libelle: "En service", ton: "valide" },
  entretien: { libelle: "À l'entretien", ton: "alerte" },
  immobilise: { libelle: "Immobilisé", ton: "danger" },
  cede: { libelle: "Cédé", ton: "neutre" },
};

export const TON_ECHEANCE: Record<string, TonPastille> = { depassee: "danger", proche: "alerte", a_venir: "neutre" };
