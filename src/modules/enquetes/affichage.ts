import type { TonPastille } from "@/components/ui/primitives";

export type StatutAffiche = "brouillon" | "ouverte" | "close";

export const LIBELLE_STATUT: Record<StatutAffiche, string> = { brouillon: "Brouillon", ouverte: "Ouverte", close: "Close" };
export const TON_STATUT: Record<StatutAffiche, TonPastille> = { brouillon: "neutre", ouverte: "valide", close: "marque" };

/** Satisfaction sur 100 : en dessous de 50, à traiter ; au-dessus de 75, bonne. */
export function tonSatisfaction(indice: number): "valide" | "alerte" | "danger" {
  if (indice >= 75) return "valide";
  if (indice >= 50) return "alerte";
  return "danger";
}
