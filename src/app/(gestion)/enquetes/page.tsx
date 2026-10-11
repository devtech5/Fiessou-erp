import type { Metadata } from "next";
import Link from "next/link";

import { FormulaireNouvelleEnquete } from "@/components/enquetes/outils-enquete";
import { CarteIndicateur, EnTetePage, EtatVide, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtEntier } from "@/lib/format";
import { divideMoney } from "@/lib/money";
import { LIBELLE_STATUT, TON_STATUT, tonSatisfaction } from "@/modules/enquetes/affichage";
import { listerEnquetes } from "@/modules/enquetes/requetes";
import { listerProjets } from "@/modules/projets/requetes";

export const metadata: Metadata = { title: "Enquêtes" };

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Abidjan" });

/** Les enquêtes de l'entreprise : collecte, satisfaction, projet commanditaire. */
export default async function PageEnquetes() {
  const session = await exigerEntreprise();
  const [enquetes, gerer, projets] = await Promise.all([
    listerEnquetes(session.organizationId),
    peut("enquetes.gerer"),
    listerProjets(session.organizationId),
  ]);

  const ouvertes = enquetes.filter((e) => e.statut === "ouverte").length;
  const reponses = enquetes.reduce((s, e) => s + e.reponses, 0);
  const notees = enquetes.filter((e) => e.satisfaction !== null);
  const moyenne = notees.length ? divideMoney(notees.reduce((s, e) => s + (e.satisfaction ?? 0), 0), notees.length) : null;

  return (
    <>
      <EnTetePage
        titre="Enquêtes et satisfaction"
        sousTitre={enquetes.length === 0 ? "Aucune enquête" : `${enquetes.length} enquête${enquetes.length > 1 ? "s" : ""} · ${ouvertes} ouverte${ouvertes > 1 ? "s" : ""}`}
        actions={gerer ? <FormulaireNouvelleEnquete projets={projets.map((p) => ({ id: p.id, nom: p.nom }))} /> : undefined}
      />

      {enquetes.length === 0 ? (
        <EtatVide
          titre="Aucune enquête"
          message="Une enquête mesure la satisfaction des clients d'un projet, ou recueille des données sur le terrain. Elle se remplit par un enquêteur, ou par le client lui-même sur un lien envoyé par WhatsApp."
        />
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
            <CarteIndicateur libelle="Enquêtes ouvertes" valeur={fmtEntier(ouvertes)} precision={`${enquetes.length} au total`} />
            <CarteIndicateur libelle="Réponses reçues" valeur={fmtEntier(reponses)} precision="Terrain et en ligne" />
            <CarteIndicateur
              libelle="Satisfaction moyenne"
              valeur={moyenne === null ? "—" : `${moyenne} / 100`}
              ton={moyenne === null ? "neutre" : tonSatisfaction(moyenne)}
              precision="Questions notées de 1 à 5"
            />
          </section>

          <Tableau>
            <thead>
              <tr>
                <Th>Enquête</Th>
                <Th>Projet</Th>
                <Th>État</Th>
                <Th aligne="droite">Réponses</Th>
                <Th aligne="droite">Satisfaction</Th>
                <Th>Dernière réponse</Th>
              </tr>
            </thead>
            <tbody>
              {enquetes.map((e) => (
                <tr key={e.id}>
                  <Td fort>
                    <Link href={`/enquetes/${e.id}`} className="hover:underline">
                      {e.titre}
                    </Link>
                    <span className="chiffres block text-xs font-normal text-[var(--encre-faible)]">{e.numero}</span>
                  </Td>
                  <Td>{e.projetNom ?? <span className="text-xs text-[var(--encre-faible)]">—</span>}</Td>
                  <Td>
                    <Pastille ton={TON_STATUT[e.statut]}>{LIBELLE_STATUT[e.statut]}</Pastille>
                  </Td>
                  <Td aligne="droite" chiffres>
                    {fmtEntier(e.reponses)}
                    {e.objectif ? <span className="text-[var(--encre-faible)]"> / {fmtEntier(e.objectif)}</span> : null}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {e.satisfaction === null ? "—" : <Pastille ton={tonSatisfaction(e.satisfaction)}>{e.satisfaction} / 100</Pastille>}
                  </Td>
                  <Td>{e.derniereReponse ? JOUR.format(e.derniereReponse) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        </>
      )}
    </>
  );
}
