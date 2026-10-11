import { CoqueSalle } from "@/components/restauration/coque-salle";

export default function LayoutRestaurant({ children }: { children: React.ReactNode }) {
  return <CoqueSalle espace="restaurant">{children}</CoqueSalle>;
}
