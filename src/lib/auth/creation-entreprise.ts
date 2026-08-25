import "server-only";

import { db } from "@/db";
import { memberships, organizations, roles } from "@/db/schema";
import { newId } from "@/lib/ids";

/**
 * Crée une entreprise, son rôle de propriétaire et le rattachement, en une
 * seule transaction.
 *
 * Les trois vont ensemble : une entreprise sans propriétaire n'est
 * administrable par personne, et un rattachement sans rôle ne donne aucun
 * droit. Les créer séparément laisserait, au moindre incident, une entreprise
 * orpheline dans la base.
 *
 * Partagé entre l'inscription — où l'entreprise naît avec l'utilisateur — et
 * la création d'une entreprise supplémentaire depuis le sélecteur.
 */
export async function creerEntreprisePour(
  userId: string,
  entreprise: { nom: string; pays: string },
  transaction?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const executer = async (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => {
    const organizationId = newId();

    await tx.insert(organizations).values({
      id: organizationId,
      name: entreprise.nom,
      // Le suffixe évite la collision entre deux « Boutique Chez Awa » sans
      // imposer un nom unique à l'exploitant : deux commerces peuvent
      // légitimement porter la même enseigne.
      slug: `${slug(entreprise.nom)}-${organizationId.slice(0, 8)}`,
      countryCode: entreprise.pays,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const roleId = newId();
    await tx.insert(roles).values({
      id: roleId,
      organizationId,
      key: "proprietaire",
      name: "Propriétaire",
      description: "Tous les droits, y compris l'abonnement.",
    });

    await tx.insert(memberships).values({
      id: newId(),
      organizationId,
      userId,
      roleId,
      status: "actif",
      isOwner: true,
      joinedAt: new Date(),
    });

    return organizationId;
  };

  return transaction ? executer(transaction) : db.transaction(executer);
}

export function slug(valeur: string): string {
  return valeur
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
