import {
  Archive,
  Building2,
  Calculator,
  CalendarCheck,
  Car,
  FileText,
  FolderKanban,
  Gavel,
  Handshake,
  History,
  Laptop,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Package,
  ShoppingCart,
  Smartphone,
  Ticket,
  Tractor,
  Upload,
  UserCog,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { CleIcone } from "@/lib/navigation";

/**
 * Une icône par module. Importées une à une : le bundle n'embarque que
 * celles-ci, pas la bibliothèque entière.
 */
const ICONES: Record<CleIcone, LucideIcon> = {
  commercial: Handshake,
  stock: Package,
  achats: ShoppingCart,
  prestataires: Wrench,
  marches: Gavel,
  reservations: CalendarCheck,
  projets: FolderKanban,
  missions: MapPin,
  actifs: Tractor,
  "parc-auto": Car,
  "parc-informatique": Laptop,
  billetterie: Ticket,
  comptabilite: Calculator,
  tresorerie: Wallet,
  guichet: Smartphone,
  personnel: Users,
  taches: ListChecks,
  messagerie: MessageCircle,
  "boite-mail": Mail,
  documents: FileText,
  archives: Archive,
  utilisateurs: UserCog,
  entreprise: Building2,
  demarrage: Upload,
  communication: Megaphone,
  journal: History,
};

export function IconeModule({ cle, className }: { cle: CleIcone; className?: string }) {
  const Icone = ICONES[cle];
  return <Icone aria-hidden className={className} strokeWidth={1.75} />;
}
