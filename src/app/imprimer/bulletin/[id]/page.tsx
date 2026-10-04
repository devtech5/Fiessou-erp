import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";

import { BoutonImprimer } from "@/components/ui/bouton-imprimer";
import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtTauxBp } from "@/lib/format";
import { libelleMois } from "@/modules/paie/calcul";
import { bulletinDetail } from "@/modules/paie/requetes";

export const metadata: Metadata = { title: "Bulletin de paie" };

/** Bulletin de paie au format A4. Seul un bulletin validé, donc numéroté, s'imprime. */
export default async function ImpressionBulletin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await exigerEntreprise();
  if (!(await peut("personnes.consulter"))) notFound();
  const detail = await bulletinDetail(session.organizationId, id);
  if (!detail?.bulletin.numero || !detail.periode?.baremeApplique) notFound();
  const { bulletin: b, periode } = detail;
  const bareme = periode.baremeApplique!;
  const [entreprise] = await db.execute<{ name: string; tax_id: string | null; address: string | null; city: string | null }>(sql`
    select name, tax_id, address, city from organizations where id = ${session.organizationId}`);

  const lignes: [string, string, number | null, number | null][] = [
    ["Salaire de base", "", b.salaireBase, null],
    ...(b.primesImposables ? [["Primes et heures supplémentaires", "", b.primesImposables, null] as [string, string, number, null]] : []),
    ["Salaire brut", "", b.brut, null],
    ["CNPS retraite, part salariale", fmtTauxBp(bareme.cnpsRetraiteSalarieBp), null, b.cnpsSalarie],
    ["Impôt sur salaire", "", null, b.impot],
    ...(b.indemnitesNonImposables ? [["Indemnités non imposables", "", b.indemnitesNonImposables, null] as [string, string, number, null]] : []),
    ...(b.retenuesDiverses ? [["Retenues diverses (avances…)", "", null, b.retenuesDiverses] as [string, string, null, number]] : []),
  ];

  return (
    <main className="min-h-dvh bg-[var(--fond)] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <BoutonImprimer />
      </div>
      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] text-[10.5pt] leading-snug text-black shadow print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-black/20 pb-4">
          <div>
            <p className="text-lg font-bold">{entreprise?.name}</p>
            {entreprise?.address && <p>{entreprise.address}</p>}
            {entreprise?.city && <p>{entreprise.city}</p>}
            {entreprise?.tax_id && <p>N° contribuable : {entreprise.tax_id}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase">Bulletin de paie</p>
            <p className="font-mono">{b.numero}</p>
            <p>Période : {libelleMois(periode.mois)}</p>
          </div>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-4 rounded border border-black/20 p-3">
          <div>
            <p className="font-semibold">{b.nom}</p>
            <p>{b.poste}</p>
          </div>
          <div className="text-right">
            <p>Matricule : {b.matricule}</p>
            <p>N° CNPS : {b.numeroCnps ?? "non renseigné"}</p>
          </div>
        </section>
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y border-black/40 text-left text-[9pt] uppercase">
              <th className="py-1.5">Rubrique</th>
              <th className="py-1.5 text-right">Taux</th>
              <th className="py-1.5 text-right">Gains</th>
              <th className="py-1.5 text-right">Retenues</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(([rubrique, t, gain, retenue]) => (
              <tr key={rubrique} className={`border-b border-black/10 ${rubrique === "Salaire brut" ? "font-semibold" : ""}`}>
                <td className="py-1.5">{rubrique}</td>
                <td className="py-1.5 text-right tabular-nums">{t}</td>
                <td className="py-1.5 text-right tabular-nums">{gain !== null ? fmt(gain) : ""}</td>
                <td className="py-1.5 text-right tabular-nums">{retenue !== null ? fmt(retenue) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 flex justify-between border-t-2 border-black pt-2 text-base font-bold tabular-nums">
          <span>Net à payer</span>
          <span>{fmt(b.net)} FCFA</span>
        </p>
        <section className="mt-6 text-[9pt] text-black/70">
          <p className="font-semibold uppercase">Charges patronales</p>
          <p className="tabular-nums">
            CNPS retraite {fmt(b.cnpsPatronal)} · Prestations familiales {fmt(b.prestationsFamiliales)} · Accident du travail {fmt(b.accidentTravail)} · Coût total employeur {fmt(b.coutTotal)} FCFA
          </p>
          {b.payeLe && <p className="mt-2">Payé le {new Date(`${String(b.payeLe).slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}.</p>}
          <p className="mt-6">Dans votre intérêt et pour vous aider à faire valoir vos droits, conservez ce bulletin sans limitation de durée.</p>
        </section>
      </article>
    </main>
  );
}
