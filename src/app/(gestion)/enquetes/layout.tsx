import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

export default async function LayoutEnquetes({ children }: { children: React.ReactNode }) {
  if (!moduleOuvert("enquetes")) return <ModuleEnPreparation cle="enquetes" />;
  if (!(await peut("enquetes.consulter"))) return <AccesRefuse droit="enquetes.consulter" />;
  return <>{children}</>;
}
