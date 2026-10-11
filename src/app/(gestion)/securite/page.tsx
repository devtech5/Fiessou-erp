import type { Metadata } from "next";
import Link from "next/link";

import { MurImages } from "@/components/securite/mur-images";
import { EnTetePage, EtatVide } from "@/components/ui/primitives";
import { env } from "@/env";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { relaisEnLigne } from "@/modules/securite/calcul";
import { sitesAvecCameras } from "@/modules/securite/requetes";

export const metadata: Metadata = { title: "Sécurité" };

/**
 * Mur d'images : les caméras de chaque site, en direct.
 *
 * Chaque caméra ouverte est inscrite au journal d'activité — qui a regardé
 * quoi, et quand. Regarder les caisses d'un magasin n'est pas un geste anodin.
 */
export default async function PageMurImages() {
  const session = await exigerEntreprise();
  const [sites, visionner, gerer] = await Promise.all([
    sitesAvecCameras(session.organizationId, true),
    peut("securite.visionner"),
    peut("securite.gerer"),
  ]);
  const maintenant = new Date();
  const avecCameras = sites.filter((s) => s.cameras.length > 0);
  const enLigne = sites.filter((s) => relaisEnLigne(s.relaisVuLe, maintenant)).length;
  const nbCameras = avecCameras.reduce((n, s) => n + s.cameras.length, 0);

  return (
    <>
      <EnTetePage
        titre="Sécurité"
        sousTitre={
          sites.length === 0
            ? "Aucun site surveillé"
            : `${sites.length} site${sites.length > 1 ? "s" : ""} · ${nbCameras} caméra${nbCameras > 1 ? "s" : ""} · ${enLigne} relais en ligne`
        }
      />

      {!env.VIDEO_URL_PUBLIQUE && (
        <p className="mb-4 rounded-lg bg-alerte-50 px-3 py-2 text-sm text-alerte-600">
          Le serveur vidéo n&apos;est pas configuré sur cette instance (VIDEO_URL_PUBLIQUE) : les caméras se déclarent, mais aucune image ne s&apos;affiche.
        </p>
      )}

      {!visionner ? (
        <EtatVide titre="Visionnage réservé" message="Votre rôle permet de voir les sites et les caméras, pas leurs images. Le responsable de l'entreprise peut vous accorder ce droit." />
      ) : avecCameras.length === 0 ? (
        <EtatVide
          titre="Aucune caméra"
          message="Déclarez un site — magasin, entrepôt, bureau — avec son enregistreur, puis ses caméras. Le relais du site publie ensuite leurs images ici."
          actions={
            gerer ? (
              <Link href="/securite/sites" className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold leading-[var(--h-cible)] text-white hover:bg-marque-700">
                Déclarer un site
              </Link>
            ) : undefined
          }
        />
      ) : (
        <MurImages
          sites={avecCameras.map((s) => ({
            id: s.id,
            nom: s.nom,
            enLigne: relaisEnLigne(s.relaisVuLe, maintenant),
            cameras: s.cameras.map((c) => ({ id: c.id, nom: c.nom, emplacement: c.emplacement, hd: c.hd })),
          }))}
        />
      )}
    </>
  );
}
