import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NoteChambreDocument } from "@/components/hotel/note-chambre-document";
import { ApercuA4 } from "@/components/impression/feuille-a4";
import { BoutonImprimer } from "@/components/ui/bouton-imprimer";
import { exigerEntreprise } from "@/lib/auth/dal";
import { identiteEntreprise } from "@/lib/identite";
import { aujourdHuiPour } from "@/modules/hotellerie/creation";
import { ficheSejour } from "@/modules/hotellerie/requetes";

export const metadata: Metadata = { title: "Note de chambre" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aperçu de la note de chambre (ou de la facture du séjour) dans l'application, sur une feuille A4. */
export default async function PageNoteChambre({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await exigerEntreprise();
  const s = await ficheSejour(session.organizationId, id);
  if (!s || s.statut === "annule") notFound();
  const [identite, departReel] = await Promise.all([
    identiteEntreprise(session.organizationId),
    s.statut === "restitue" && s.departLe ? aujourdHuiPour(session.organizationId, s.departLe) : Promise.resolve(null),
  ]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href={`/hotel/sejours/${s.id}`} className="text-sm text-[var(--encre-douce)] hover:underline">
            ← Séjour {s.numero}
          </Link>
          <h1 className="mt-1 text-lg font-semibold">
            {s.statut === "restitue" ? "Facture de séjour" : "Note provisoire"}{" "}
            <span className="text-sm font-normal text-[var(--encre-faible)]">
              · {s.client.nom}, chambre {s.chambre.code}
            </span>
          </h1>
        </div>
        <BoutonImprimer />
      </div>

      <ApercuA4>
        <NoteChambreDocument sejour={s} identite={identite} departReel={departReel} />
      </ApercuA4>
    </>
  );
}
