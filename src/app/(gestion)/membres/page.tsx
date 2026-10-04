import type { Metadata } from "next";

import { EnTetePage } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { restrictionsParMembre } from "@/lib/auth/acces";
import { listerMembres, rolesAttribuables } from "@/lib/auth/membres";
import { fmtDateIso } from "@/lib/format";
import { FormulaireMembre } from "./formulaire-membre";
import { ListeMembres, type LigneMembre } from "./liste-membres";

export const metadata: Metadata = { title: "Membres" };

export default async function PageMembres() {
  const session = await exigerEntreprise();

  const [membres, roles, restrictions] = await Promise.all([
    listerMembres(session.organizationId),
    rolesAttribuables(session.organizationId),
    restrictionsParMembre(session.organizationId),
  ]);

  const actifs = membres.filter((membre) => membre.statut === "actif").length;

  // La date est mise en forme ici, pas dans le composant client : un rendu
  // client dépendrait du fuseau du navigateur et ne retomberait pas sur le
  // rendu serveur, ce que React signale comme une erreur d'hydratation.
  const lignes: LigneMembre[] = membres.map((membre) => ({
    membershipId: membre.membershipId,
    userId: membre.userId,
    nom: membre.nom,
    email: membre.email,
    roleId: membre.roleId,
    roleNom: membre.roleNom,
    statut: membre.statut,
    proprietaire: membre.proprietaire,
    restrictions: restrictions.get(membre.membershipId) ?? 0,
    depuis: membre.rejointLe
      ? fmtDateIso(membre.rejointLe.toISOString().slice(0, 10))
      : null,
  }));

  return (
    <>
      <EnTetePage
        titre="Utilisateurs"
        sousTitre={
          membres.length === 1
            ? "Vous êtes seul à ouvrir le logiciel"
            : `${membres.length} accès · ${actifs} en activité`
        }
        actions={<FormulaireMembre roles={roles} />}
      />

      <ListeMembres membres={lignes} roles={roles} moiId={session.userId} />
    </>
  );
}
