"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  mettreEnFile,
  operationsLocales,
  rejouer,
  ecarter,
  type OperationLocale,
} from "@/lib/terrain/file-locale";
import { rapporterTerrain, type OperationTerrain } from "@/modules/missions/actions";

export type IssueRemontee =
  | { genre: "envoyee"; statut?: string }
  | { genre: "en_file" }
  | { genre: "refusee"; message: string };

/**
 * Remontée du terrain, avec file locale.
 *
 * Une opération part d'abord vers le serveur. Si le réseau manque (l'appel
 * lève), elle est écrite sur l'appareil et rejouée au retour de la connexion :
 * l'utilisateur n'a rien à refaire, et rien n'est perdu. Si le serveur la
 * REFUSE (mission close, preuve manquante), elle n'est pas mise en file — un
 * refus n'est pas un problème de réseau, et le rejouer produirait le même.
 */
export function useRemontee() {
  const routeur = useRouter();
  const [locales, setLocales] = useState<OperationLocale[]>([]);

  const actualiser = useCallback(async () => {
    setLocales(await operationsLocales());
  }, []);

  const vider = useCallback(async () => {
    const bilan = await rejouer(async (operation) => {
      const reponse = await rapporterTerrain(operation as OperationTerrain);
      return reponse.ok ? { ok: true } : { ok: false, message: reponse.message };
    });
    await actualiser();
    if (bilan.envoyees > 0) routeur.refresh();
  }, [actualiser, routeur]);

  // Au montage et au retour du réseau : la file part d'elle-même. Un chef
  // d'équipe n'a pas à savoir qu'il existe un bouton « synchroniser ».
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void vider();
    window.addEventListener("online", vider);
    return () => window.removeEventListener("online", vider);
  }, [vider]);

  const rapporter = useCallback(
    async (operation: OperationTerrain): Promise<IssueRemontee> => {
      try {
        const reponse = await rapporterTerrain(operation);
        if (!reponse.ok) return { genre: "refusee", message: reponse.message };
        routeur.refresh();
        return { genre: "envoyee", statut: reponse.statut };
      } catch {
        const rang = await mettreEnFile(operation);
        await actualiser();
        if (rang === null) {
          return {
            genre: "refusee",
            message: "Pas de réseau, et cet appareil ne peut pas conserver la saisie.",
          };
        }
        return { genre: "en_file" };
      }
    },
    [actualiser, routeur],
  );

  const ecarterRefusee = useCallback(
    async (rang: number) => {
      await ecarter(rang);
      await actualiser();
    },
    [actualiser],
  );

  return {
    rapporter,
    vider,
    ecarterRefusee,
    enAttente: locales.filter((o) => o.etat === "en_attente").length,
    refusees: locales.filter((o) => o.etat === "refusee"),
  };
}
