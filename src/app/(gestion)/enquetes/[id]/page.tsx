import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditionQuestions, PilotageEnquete } from "@/components/enquetes/outils-enquete";
import { SyntheseVue } from "@/components/enquetes/synthese";
import { CarteIndicateur, EnTetePage, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtEntier } from "@/lib/format";
import { LIBELLE_STATUT, TON_STATUT, tonSatisfaction } from "@/modules/enquetes/affichage";
import { ecrireQuestions } from "@/modules/enquetes/calcul";
import { ficheEnquete } from "@/modules/enquetes/requetes";

export const metadata: Metadata = { title: "Enquête" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORODATAGE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

/** Une enquête : ses résultats question par question, ses réponses, son pilotage. */
export default async function PageEnquete({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await exigerEntreprise();
  const [fiche, gerer, saisir] = await Promise.all([ficheEnquete(session.organizationId, id), peut("enquetes.gerer"), peut("enquetes.saisir")]);
  if (!fiche) notFound();

  const terrain = fiche.reponses.filter((r) => r.canal === "terrain").length;
  const libelles = new Map(fiche.questions.map((q) => [q.cle, q.libelle]));

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/enquetes" className="text-[var(--encre-douce)] hover:underline">
          ← Toutes les enquêtes
        </Link>
      </p>
      <EnTetePage
        titre={fiche.titre}
        sousTitre={[fiche.numero, fiche.projetNom ? `Projet ${fiche.projetNom}` : null].filter(Boolean).join(" · ")}
        actions={gerer ? <PilotageEnquete enqueteId={fiche.id} statut={fiche.statut} lienActif={fiche.lienPublic} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pastille ton={TON_STATUT[fiche.statut]}>{LIBELLE_STATUT[fiche.statut]}</Pastille>
        {!fiche.lienPublic && <Pastille>Lien public coupé</Pastille>}
        {saisir && fiche.statut === "ouverte" && (
          <Link
            href={`/enquetes/${fiche.id}/saisir`}
            className="h-cible rounded-lg bg-marque-600 px-3.5 text-sm font-semibold leading-[var(--h-cible)] text-white hover:bg-marque-700"
          >
            Recueillir une réponse
          </Link>
        )}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
        <CarteIndicateur
          libelle="Réponses"
          valeur={fmtEntier(fiche.reponses.length)}
          unite={fiche.objectif ? `/ ${fmtEntier(fiche.objectif)}` : undefined}
          precision={`${terrain} sur le terrain · ${fiche.reponses.length - terrain} en ligne`}
        />
        <CarteIndicateur
          libelle="Satisfaction"
          valeur={fiche.satisfaction === null ? "—" : `${fiche.satisfaction} / 100`}
          ton={fiche.satisfaction === null ? "neutre" : tonSatisfaction(fiche.satisfaction)}
          precision="Moyenne des questions notées de 1 à 5"
        />
        <CarteIndicateur libelle="Questions" valeur={fmtEntier(fiche.questions.length)} precision={fiche.reponses.length > 0 ? "Figées depuis la première réponse" : "Modifiables tant qu'aucune réponse n'est reçue"} />
      </section>

      {gerer && fiche.reponses.length === 0 && (
        <div className="mb-5">
          <EditionQuestions enqueteId={fiche.id} texteInitial={ecrireQuestions(fiche.questions)} />
        </div>
      )}

      <section className="mb-6 grid gap-3 lg:grid-cols-2">
        {fiche.syntheses.map(({ question, synthese }) => (
          <SyntheseVue key={question.cle} libelle={question.libelle} synthese={synthese} />
        ))}
      </section>

      <h2 className="mb-2 text-base font-semibold">Dernières réponses</h2>
      {fiche.reponses.length === 0 ? (
        <p className="text-sm text-[var(--encre-faible)]">Aucune réponse pour l&apos;instant.</p>
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Reçue</Th>
              <Th>Canal</Th>
              <Th>Répondant</Th>
              <Th>Réponses</Th>
            </tr>
          </thead>
          <tbody>
            {fiche.reponses.slice(0, 50).map((r) => (
              <tr key={r.id}>
                <Td chiffres>{HORODATAGE.format(r.priseLe)}</Td>
                <Td>
                  {r.canal === "terrain" ? `Terrain${r.enqueteur ? ` · ${r.enqueteur}` : ""}${r.aPosition ? " · localisée" : ""}` : "En ligne"}
                </Td>
                <Td>{r.repondant ?? <span className="text-xs text-[var(--encre-faible)]">Anonyme</span>}</Td>
                <Td>
                  <span className="line-clamp-2 text-xs text-[var(--encre-douce)]">
                    {Object.entries(r.valeurs)
                      .map(([cle, v]) => `${libelles.get(cle) ?? cle} : ${v === true ? "oui" : v === false ? "non" : v}`)
                      .join(" · ")}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  );
}
