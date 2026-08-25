"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker de la caisse.
 *
 * Monté sur l'écran de caisse et nulle part ailleurs : c'est le seul écran dont
 * l'indisponibilité arrête le commerce. Enregistrer un service worker pour
 * l'application de gestion apporterait peu et compliquerait chaque déploiement.
 *
 * En développement, on s'abstient : Next y sert des modules non versionnés que
 * le rechargement à chaud remplace en permanence, et un cache par-dessus donne
 * des symptômes que personne ne sait diagnostiquer.
 */
export function ServiceWorkerCaisse() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const enregistrer = () =>
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Un enregistrement refusé — navigateur ancien, mode privé, HTTP sans
        // TLS — n'empêche pas de vendre : la file locale fonctionne quand même,
        // seule l'ouverture hors ligne de la page est perdue.
      });

    // Après le chargement : disputer la bande passante au premier rendu de la
    // caisse retarderait l'affichage du catalogue, qui est ce que le caissier
    // attend.
    if (document.readyState === "complete") enregistrer();
    else window.addEventListener("load", enregistrer, { once: true });

    return () => window.removeEventListener("load", enregistrer);
  }, []);

  return null;
}
