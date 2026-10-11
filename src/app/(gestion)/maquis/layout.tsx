import { CoqueSalle } from "@/components/restauration/coque-salle";

export default function LayoutMaquis({ children }: { children: React.ReactNode }) {
  return <CoqueSalle espace="maquis">{children}</CoqueSalle>;
}
