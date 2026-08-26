"use client";

import { useRef } from "react";

import { Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import type { RoleAttribuable } from "@/lib/auth/membres";
import { changerRoleMembre, changerStatutMembre } from "./actions";

export interface LigneMembre {
  membershipId: string;
  userId: string;
  nom: string;
  telephone: string;
  roleId: string;
  roleNom: string;
  statut: "invite" | "actif" | "suspendu";
  proprietaire: boolean;
  /** Date de rattachement, déjà mise en forme par le serveur. */
  depuis: string | null;
}

const TONS = {
  actif: "valide",
  invite: "alerte",
  suspendu: "danger",
} as const;

const ETIQUETTES = {
  actif: "Actif",
  invite: "Invité",
  suspendu: "Suspendu",
} as const;

/**
 * Qui ouvre le logiciel, et avec quel rôle.
 *
 * Deux lignes ne se modifient pas : celle du propriétaire, et la sienne. Les
 * contrôles y sont absents plutôt que désactivés puis refusés — un bouton qui
 * ne mène jamais nulle part n'a pas à être affiché. Le serveur refuse quand
 * même : l'écran cache, l'action refuse.
 */
export function ListeMembres({
  membres,
  roles,
  moiId,
}: {
  membres: LigneMembre[];
  roles: RoleAttribuable[];
  moiId: string;
}) {
  return (
    <Tableau>
      <thead>
        <tr>
          <Th>Personne</Th>
          <Th>Rôle</Th>
          <Th>Statut</Th>
          <Th aligne="droite">Accès</Th>
        </tr>
      </thead>
      <tbody>
        {membres.map((membre) => {
          const fige = membre.proprietaire || membre.userId === moiId;

          return (
            <tr key={membre.membershipId}>
              <Td>
                <span className="block font-medium">{membre.nom}</span>
                <span className="chiffres block text-xs text-[var(--encre-faible)]">
                  {membre.telephone}
                  {membre.depuis && ` · depuis le ${membre.depuis}`}
                </span>
              </Td>

              <Td>
                {fige ? (
                  <span className="flex items-center gap-2">
                    {membre.roleNom}
                    {membre.proprietaire && <Pastille ton="marque">Propriétaire</Pastille>}
                  </span>
                ) : (
                  <SelecteurRole membre={membre} roles={roles} />
                )}
              </Td>

              <Td>
                <Pastille ton={TONS[membre.statut]}>
                  {ETIQUETTES[membre.statut]}
                </Pastille>
              </Td>

              <Td aligne="droite">
                {fige ? (
                  <span className="text-xs text-[var(--encre-faible)]">
                    {membre.proprietaire ? "Ne se coupe pas" : "Vous"}
                  </span>
                ) : (
                  <form action={changerStatutMembre} className="inline">
                    <input type="hidden" name="membershipId" value={membre.membershipId} />
                    <input
                      type="hidden"
                      name="suspendre"
                      value={membre.statut === "suspendu" ? "0" : "1"}
                    />
                    <button
                      type="submit"
                      className={`rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-[var(--surface-creuse)] ${
                        membre.statut === "suspendu"
                          ? "text-valide-600"
                          : "text-danger-600"
                      }`}
                    >
                      {membre.statut === "suspendu" ? "Rétablir" : "Suspendre"}
                    </button>
                  </form>
                )}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Tableau>
  );
}

/**
 * Le rôle se change sur place, sans bouton de validation.
 *
 * Un « Enregistrer » par ligne ferait un tableau de boutons ; le changement
 * part au relâchement de la liste déroulante, comme partout ailleurs dans
 * l'application.
 */
function SelecteurRole({
  membre,
  roles,
}: {
  membre: LigneMembre;
  roles: RoleAttribuable[];
}) {
  const formulaire = useRef<HTMLFormElement>(null);

  // Un rôle qui n'est plus attribuable — le propriétaire, ou un rôle supprimé
  // depuis — reste affiché, sans pouvoir être repris. Sans cette option, le
  // navigateur retomberait sur la première de la liste et montrerait à ce
  // membre un rôle qui n'est pas le sien.
  const horsListe = !roles.some((role) => role.id === membre.roleId);

  return (
    <form ref={formulaire} action={changerRoleMembre}>
      <input type="hidden" name="membershipId" value={membre.membershipId} />
      <select
        name="roleId"
        defaultValue={membre.roleId}
        onChange={() => formulaire.current?.requestSubmit()}
        aria-label={`Rôle de ${membre.nom}`}
        className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--fond)] px-2.5 text-sm outline-none focus:border-marque-500"
      >
        {horsListe && (
          <option value={membre.roleId} disabled>
            {membre.roleNom}
          </option>
        )}
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.nom}
          </option>
        ))}
      </select>
    </form>
  );
}
