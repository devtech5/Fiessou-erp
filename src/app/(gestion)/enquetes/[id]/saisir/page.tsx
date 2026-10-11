import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRefuse } from "@/components/coque/acces-refuse";
import { FormulaireReponse } from "@/components/enquetes/formulaire-reponse";
import { EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { ficheEnquete } from "@/modules/enquetes/requetes";

export const metadata: Metadata = { title: "Recueillir une réponse" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Écran de l'enquêteur : le questionnaire, répondant après répondant. */
export default async function PageSaisie({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await exigerEntreprise();
  if (!(await peut("enquetes.saisir"))) return <AccesRefuse droit="enquetes.saisir" />;
  const fiche = await ficheEnquete(session.organizationId, id);
  if (!fiche) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-3 text-sm">
        <Link href={`/enquetes/${fiche.id}`} className="text-[var(--encre-douce)] hover:underline">
          ← Résultats de l&apos;enquête
        </Link>
      </p>
      <EnTetePage titre={fiche.titre} sousTitre={`${fiche.numero} · ${fiche.reponses.length} réponse${fiche.reponses.length > 1 ? "s" : ""} recueillie${fiche.reponses.length > 1 ? "s" : ""}`} />
      {fiche.statut !== "ouverte" ? (
        <EtatVide titre="Enquête fermée" message="Cette enquête n'est pas ouverte aux réponses. Son responsable peut l'ouvrir depuis la page de résultats." />
      ) : (
        <>
          {fiche.introduction && <p className="mb-4 text-sm text-[var(--encre-douce)]">{fiche.introduction}</p>}
          <FormulaireReponse questions={fiche.questions} mode={{ canal: "terrain", enqueteId: fiche.id }} />
        </>
      )}
    </div>
  );
}
