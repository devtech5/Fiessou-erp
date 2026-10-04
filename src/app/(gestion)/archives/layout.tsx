import { AccesRefuse } from "@/components/coque/acces-refuse";
import { ModuleEnPreparation } from "@/components/coque/module-en-preparation";
import { SousNavigation } from "@/components/coque/sous-navigation";
import { peut } from "@/lib/droits/garde";
import { moduleOuvert } from "@/lib/modules/garde";

/**
 * Trois vues sur les mêmes archives : l'espace de chacun, les dossiers
 * partagés que l'administration lui ouvre, et la supervision de
 * l'administrateur légal — celle-ci n'apparaît qu'à qui en porte le droit.
 */
export default async function LayoutArchives({ children }: LayoutProps<"/archives">) {
  if (!moduleOuvert("archives")) return <ModuleEnPreparation cle="archives" />;

  const [consulter, gestionnaire, superviser] = await Promise.all([
    peut("archives.consulter"),
    peut("archives.dossier.gerer"),
    peut("archives.superviser"),
  ]);
  if (!consulter && !gestionnaire && !superviser) return <AccesRefuse droit="archives.consulter" />;

  const sections = [
    ...(consulter ? [{ href: "/archives", libelle: "Mes archives" }] : []),
    ...(consulter || gestionnaire ? [{ href: "/archives/dossiers", libelle: "Dossiers partagés" }] : []),
    ...(superviser ? [{ href: "/archives/supervision", libelle: "Supervision" }] : []),
  ];

  return (
    <>
      {sections.length > 1 && <SousNavigation entrees={sections} />}
      {children}
    </>
  );
}
