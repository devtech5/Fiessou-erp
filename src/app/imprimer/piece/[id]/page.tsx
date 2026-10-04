import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtDateIso, fmtTauxBp } from "@/lib/format";
import { formaterQuantite, type CodeUnite } from "@/lib/quantite";
import { resteDu, totaliserPiece } from "@/modules/facturation/calcul";
import { detailsPieces, listerPieces } from "@/modules/facturation/requetes";

import { BoutonImprimer } from "./bouton-imprimer";

export const metadata: Metadata = { title: "Impression" };

const TITRE = { devis: "Devis", facture: "Facture", avoir: "Avoir" } as const;

/**
 * Pièce commerciale au format A4, prête à imprimer ou à enregistrer en PDF.
 *
 * Hors de la coque de gestion : une facture imprimée ne porte ni barre
 * latérale ni menu. Les mentions viennent de la fiche entreprise et de la
 * fiche client — identifiant fiscal (NCC en Côte d'Ivoire) compris — et non
 * d'un modèle figé : c'est le pays de l'entreprise qui décide.
 */
export default async function PageImpressionPiece({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await exigerEntreprise();
  if (!(await peut("commercial.piece.consulter"))) notFound();

  const [pieces, details, entreprises, clients] = await Promise.all([
    listerPieces(session.organizationId),
    detailsPieces(session.organizationId),
    db.execute<{
      name: string;
      tax_id: string | null;
      legal_form: string | null;
      address: string | null;
      city: string | null;
      phone: string | null;
      email: string | null;
    }>(sql`
      select name, tax_id, legal_form, address, city, phone, email
      from organizations where id = ${session.organizationId}`),
    db.execute<{
      id: string;
      adresse: string | null;
      ville: string | null;
      telephone: string | null;
      identifiant_fiscal: string | null;
    }>(sql`
      select t.id, t.adresse, t.ville, t.telephone, t.identifiant_fiscal
      from tiers t
        join pieces_commerciales p on p.client_id = t.id
      where p.id = ${id} and p.organization_id = ${session.organizationId}`),
  ]);

  const piece = pieces.find((p) => p.id === id);
  // Un brouillon n'a pas de numéro : il ne s'imprime pas comme une pièce.
  if (!piece || !piece.numero) notFound();

  const lignes = details.lignes.get(piece.id) ?? [];
  const reglements = details.reglements.get(piece.id) ?? [];
  const entreprise = entreprises[0];
  const client = clients[0];
  const parTaux = totaliserPiece(
    lignes.map((l) => ({
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaireHt: l.prixUnitaireHt,
      remise: l.remise,
      tauxTva: l.tauxTva,
      compteVente: l.compteVente,
    })),
  ).parTaux;
  const reste = resteDu(piece.totalTtc, piece.regle);

  return (
    <main className="min-h-dvh bg-[var(--fond)] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-3 px-4 print:hidden">
        <BoutonImprimer />
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] text-[10.5pt] leading-snug text-black shadow print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-black/20 pb-5">
          <div>
            <p className="text-lg font-bold">{entreprise?.name}</p>
            {entreprise?.legal_form && <p>{entreprise.legal_form}</p>}
            {entreprise?.address && <p>{entreprise.address}</p>}
            {entreprise?.city && <p>{entreprise.city}</p>}
            {entreprise?.phone && <p>Tél. {entreprise.phone}</p>}
            {entreprise?.email && <p>{entreprise.email}</p>}
            {entreprise?.tax_id && <p>N° contribuable : {entreprise.tax_id}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold uppercase tracking-wide">{TITRE[piece.nature]}</p>
            <p className="font-mono text-base">{piece.numero}</p>
            <p>Date : {fmtDateIso(piece.datePiece)}</p>
            {piece.echeance && (
              <p>
                {piece.nature === "devis" ? "Valable jusqu'au" : "Échéance"} :{" "}
                {fmtDateIso(piece.echeance)}
              </p>
            )}
            {piece.origineNumero && <p>Réf. {piece.origineNumero}</p>}
          </div>
        </header>

        <section className="mt-5 ml-auto w-[45%] rounded border border-black/20 p-3">
          <p className="text-[9pt] uppercase text-black/60">Client</p>
          <p className="font-semibold">{piece.clientNom}</p>
          {client?.adresse && <p>{client.adresse}</p>}
          {client?.ville && <p>{client.ville}</p>}
          {client?.telephone && <p>Tél. {client.telephone}</p>}
          {client?.identifiant_fiscal && <p>N° contribuable : {client.identifiant_fiscal}</p>}
        </section>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-y border-black/40 text-left text-[9pt] uppercase">
              <th className="py-1.5">Désignation</th>
              <th className="py-1.5 text-right">Qté</th>
              <th className="py-1.5 text-right">PU HT</th>
              <th className="py-1.5 text-right">Remise</th>
              <th className="py-1.5 text-right">TVA</th>
              <th className="py-1.5 text-right">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, index) => (
              <tr key={index} className="border-b border-black/10 align-top">
                <td className="py-1.5 pr-2">{l.designation}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formaterQuantite(l.quantite, l.unite as CodeUnite)}
                </td>
                <td className="py-1.5 text-right tabular-nums">{fmt(l.prixUnitaireHt)}</td>
                <td className="py-1.5 text-right tabular-nums">{l.remise > 0 ? fmt(l.remise) : ""}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtTauxBp(l.tauxTva)}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(l.montantHt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 ml-auto w-[55%] space-y-0.5 tabular-nums">
          <div className="flex justify-between">
            <dt>Total HT</dt>
            <dd>{fmt(piece.totalHt)}</dd>
          </div>
          {parTaux.map((t) => (
            <div key={t.tauxTva} className="flex justify-between">
              <dt>
                TVA {fmtTauxBp(t.tauxTva)} sur {fmt(t.base)}
              </dt>
              <dd>{fmt(t.tva)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-black/40 pt-1 text-base font-bold">
            <dt>Total TTC</dt>
            <dd>{fmt(piece.totalTtc)} FCFA</dd>
          </div>
          {piece.nature === "facture" && piece.regle > 0 && (
            <>
              <div className="flex justify-between">
                <dt>Déjà réglé</dt>
                <dd>{fmt(piece.regle)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Reste à payer</dt>
                <dd>{fmt(reste)} FCFA</dd>
              </div>
            </>
          )}
        </dl>

        {reglements.length > 0 && (
          <p className="mt-4 text-[9pt] text-black/70">
            Règlements reçus :{" "}
            {reglements.map((r) => `${r.numero} du ${fmtDateIso(r.date)} (${fmt(r.montant)})`).join(" ; ")}
          </p>
        )}

        {piece.notes && <p className="mt-6 whitespace-pre-line">{piece.notes}</p>}

        {piece.statut === "annulee" && (
          <p className="mt-6 rounded border border-black/40 p-2 text-center font-semibold uppercase">
            Pièce annulée
          </p>
        )}
      </article>
    </main>
  );
}
