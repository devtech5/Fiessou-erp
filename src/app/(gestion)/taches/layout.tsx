import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

export default async function LayoutTaches({ children }: LayoutProps<"/taches">) {
  if (!moduleOuvert("taches")) return <ModuleEnPreparation cle="taches" />;
  if (!(await peut("taches.consulter"))) return <AccesRefuse droit="taches.consulter" />;
  return children;
}
