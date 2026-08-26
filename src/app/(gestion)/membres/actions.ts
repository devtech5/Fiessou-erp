"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs, memberships, roles, users } from "@/db/schema";
import { exigerEntreprise } from "@/lib/auth/dal";
import { rattachementDe } from "@/lib/auth/membres";
import { normaliserTelephone } from "@/lib/auth/otp";
import { exigerDroit, refusDroit } from "@/lib/droits/garde";
import { newId } from "@/lib/ids";

export interface EtatMembre {
  erreur?: string;
  /** Nom du membre ajouté — sert à confirmer sans recharger la liste. */
  ajoute?: string;
}

const schemaAjout = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom de la personne."),
  telephone: z.string().trim().min(1, "Indiquez un numéro de téléphone."),
  roleId: z.uuid("Choisissez un rôle."),
});

/**
 * Donne accès au logiciel à quelqu'un.
 *
 * L'accès est ouvert tout de suite, pas mis en attente d'acceptation : le
 * gérant crée le compte de son caissier devant lui, et celui-ci se connecte
 * avec son numéro dans la minute. Une invitation à accepter par courriel
 * suppose une adresse relevée, ce qui n'est pas l'usage sur ce marché — le
 * téléphone l'est.
 *
 * Le code à usage unique reste la barrière : le rattachement n'ouvre rien tant
 * que la personne n'a pas prouvé qu'elle tient le numéro.
 */
export async function ajouterMembre(
  _precedent: EtatMembre,
  donnees: FormData,
): Promise<EtatMembre> {
  const session = await exigerEntreprise();

  const refus = await refusDroit("organisation.membre.gerer");
  if (refus) return refus;

  const analyse = schemaAjout.safeParse({
    nom: donnees.get("nom"),
    telephone: donnees.get("telephone"),
    roleId: donnees.get("roleId"),
  });

  if (!analyse.success) return { erreur: analyse.error.issues[0].message };

  const telephone = normaliserTelephone(analyse.data.telephone);
  if (!telephone) {
    return { erreur: "Numéro invalide. Dix chiffres, ou indicatif compris." };
  }

  // Le rôle vient du navigateur : il doit appartenir à cette entreprise, sinon
  // un identifiant deviné donnerait les droits d'un rôle d'ailleurs.
  const [role] = await db
    .select({ id: roles.id, cle: roles.key, nom: roles.name })
    .from(roles)
    .where(
      and(eq(roles.id, analyse.data.roleId), eq(roles.organizationId, session.organizationId)),
    );

  if (!role) return { erreur: "Ce rôle n'existe pas dans cette entreprise." };

  // L'écran ne le propose pas ; l'action le refuse quand même. Une action
  // serveur est une route HTTP, et l'identifiant du rôle vient du navigateur.
  if (role.cle === "proprietaire") {
    return { erreur: "Le rôle de propriétaire ne s'attribue pas." };
  }

  try {
    await db.transaction(async (tx) => {
      const [existant] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, telephone));

      let userId = existant?.id;

      if (!userId) {
        // Le compte naît sans numéro vérifié : c'est la connexion qui le
        // vérifiera. Le nom vient du gérant, la personne pourra le corriger.
        userId = newId();
        await tx.insert(users).values({
          id: userId,
          phone: telephone,
          fullName: analyse.data.nom,
        });
      }

      await tx.insert(memberships).values({
        id: newId(),
        organizationId: session.organizationId,
        userId,
        roleId: role.id,
        status: "actif",
        isOwner: false,
        joinedAt: new Date(),
      });

      await tx.insert(auditLogs).values({
        id: newId(),
        organizationId: session.organizationId,
        userId: session.userId,
        action: "membre.ajouter",
        entityType: "membership",
        entityId: userId,
        after: { telephone, nom: analyse.data.nom, role: role.nom },
      });
    });
  } catch (erreur) {
    // 23505 : violation d'unicité. Ici, un rattachement déjà existant entre
    // cette personne et cette entreprise.
    if (erreur instanceof Error && "code" in erreur && erreur.code === "23505") {
      return { erreur: "Cette personne a déjà un accès à cette entreprise." };
    }
    throw erreur;
  }

  revalidatePath("/membres");
  return { ajoute: analyse.data.nom };
}

/**
 * Change le rôle d'un membre.
 *
 * Le propriétaire est intouchable : son rôle est la seule garantie qu'il
 * restera quelqu'un pour administrer l'entreprise. Sans cette règle, un gérant
 * pourrait rétrograder celui à qui le commerce appartient.
 */
export async function changerRoleMembre(donnees: FormData): Promise<void> {
  const session = await exigerDroit("organisation.membre.gerer");

  const membershipId = String(donnees.get("membershipId") ?? "");
  const roleId = String(donnees.get("roleId") ?? "");

  const rattachement = await rattachementDe(session.organizationId, membershipId);
  if (!rattachement || rattachement.roleId === roleId) return;

  if (rattachement.proprietaire) {
    throw new Error("Le rôle du propriétaire ne se change pas.");
  }

  // Se rétrograder soi-même reviendrait à se fermer la porte, sans personne
  // pour la rouvrir si l'on était le seul à tenir ce droit.
  if (rattachement.userId === session.userId) {
    throw new Error("On ne change pas son propre rôle.");
  }

  const [role] = await db
    .select({ id: roles.id, cle: roles.key, nom: roles.name })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.organizationId, session.organizationId)));

  if (!role) return;

  if (role.cle === "proprietaire") {
    throw new Error("Le rôle de propriétaire ne s'attribue pas.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ roleId: role.id, updatedAt: new Date() })
      .where(eq(memberships.id, membershipId));

    await tx.insert(auditLogs).values({
      id: newId(),
      organizationId: session.organizationId,
      userId: session.userId,
      action: "membre.role",
      entityType: "membership",
      entityId: rattachement.userId,
      after: { role: role.nom },
    });
  });

  revalidatePath("/membres");
}

/**
 * Suspend un accès, ou le rétablit.
 *
 * Pas de suppression : le rattachement porte l'historique de qui a encaissé,
 * saisi, corrigé. L'effacer laisserait des pièces sans auteur, et une caisse
 * dont on ne sait plus qui la tenait ne se contrôle plus.
 */
export async function changerStatutMembre(donnees: FormData): Promise<void> {
  const session = await exigerDroit("organisation.membre.gerer");

  const membershipId = String(donnees.get("membershipId") ?? "");
  const suspendre = donnees.get("suspendre") === "1";

  const rattachement = await rattachementDe(session.organizationId, membershipId);
  if (!rattachement) return;

  if (rattachement.proprietaire) {
    throw new Error("L'accès du propriétaire ne se coupe pas.");
  }

  if (rattachement.userId === session.userId) {
    throw new Error("On ne coupe pas son propre accès.");
  }

  const statut = suspendre ? "suspendu" : "actif";

  await db.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ status: statut, updatedAt: new Date() })
      .where(eq(memberships.id, membershipId));

    await tx.insert(auditLogs).values({
      id: newId(),
      organizationId: session.organizationId,
      userId: session.userId,
      action: "membre.statut",
      entityType: "membership",
      entityId: rattachement.userId,
      after: { statut },
    });
  });

  revalidatePath("/membres");
}
