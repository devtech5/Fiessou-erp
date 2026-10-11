import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FormulaireCamera, PanneauRelais, ReglageCamera } from "@/components/securite/formulaires";
import { CarteIndicateur, EnTetePage, EtatVide, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtEntier } from "@/lib/format";
import { LIBELLE_MARQUE, LIBELLE_NATURE, debitMontant, relaisEnLigne } from "@/modules/securite/calcul";
import { siteAvecCameras } from "@/modules/securite/requetes";

export const metadata: Metadata = { title: "Site surveillé" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORODATAGE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

/** Un site : son enregistreur, ses caméras, son relais. */
export default async function PageSite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await exigerEntreprise();
  const [site, gerer] = await Promise.all([siteAvecCameras(session.organizationId, id), peut("securite.gerer")]);
  if (!site) notFound();

  const actives = site.cameras.filter((c) => c.actif);
  const enLigne = relaisEnLigne(site.relaisVuLe, new Date());
  const prochainCanal = Math.max(0, ...site.cameras.map((c) => c.canal)) + 1;

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/securite/sites" className="text-[var(--encre-douce)] hover:underline">
          ← Tous les sites
        </Link>
      </p>
      <EnTetePage
        titre={site.nom}
        sousTitre={[LIBELLE_NATURE[site.nature], site.adresse].filter(Boolean).join(" · ")}
        actions={gerer && prochainCanal <= 256 ? <FormulaireCamera siteId={site.id} prochainCanal={prochainCanal} /> : undefined}
      />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
        <CarteIndicateur libelle="Enregistreur" valeur={site.enregistreurAdresse} precision={`${LIBELLE_MARQUE[site.marque]} · port ${site.enregistreurPort}`} />
        <CarteIndicateur
          libelle="Relais"
          valeur={!site.relaisEmpreinte ? "À installer" : enLigne ? "En ligne" : "Hors ligne"}
          ton={!site.relaisEmpreinte ? "neutre" : enLigne ? "valide" : "alerte"}
          precision={site.relaisVuLe ? `Dernière publication ${HORODATAGE.format(site.relaisVuLe)}` : "Aucune publication reçue"}
        />
        <CarteIndicateur
          libelle="Débit montant à prévoir"
          valeur={fmtEntier(debitMontant(actives))}
          unite="kbit/s"
          precision={`${actives.length} caméra${actives.length > 1 ? "s" : ""} au mur, en continu`}
        />
      </section>

      {site.cameras.length === 0 ? (
        <EtatVide titre="Aucune caméra" message="Ajoutez les caméras de l'enregistreur, canal par canal. Seules les caméras au mur sont publiées par le relais." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th aligne="droite">Canal</Th>
              <Th>Caméra</Th>
              <Th>Emplacement</Th>
              <Th>Qualité</Th>
              <Th>État</Th>
              {gerer && <Th aligne="droite">{""}</Th>}
            </tr>
          </thead>
          <tbody>
            {site.cameras.map((c) => (
              <tr key={c.id}>
                <Td aligne="droite" chiffres>
                  {c.canal}
                </Td>
                <Td fort>{c.nom}</Td>
                <Td>{c.emplacement ?? "—"}</Td>
                <Td>{c.hd ? "Mosaïque + HD" : "Mosaïque"}</Td>
                <Td>{c.actif ? <Pastille ton="valide">Au mur</Pastille> : <Pastille>Retirée</Pastille>}</Td>
                {gerer && (
                  <Td aligne="droite">
                    <ReglageCamera cameraId={c.id} actif={c.actif} hd={c.hd} />
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      {gerer && (
        <div className="mt-6">
          <PanneauRelais siteId={site.id} nomSite={site.nom} aUneCle={Boolean(site.relaisEmpreinte)} />
        </div>
      )}
    </>
  );
}
