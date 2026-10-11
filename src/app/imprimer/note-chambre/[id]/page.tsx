import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EnTeteDocument, PiedDocument } from "@/components/impression/entete-document";
import { BoutonImprimer } from "@/components/ui/bouton-imprimer";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtTauxBp } from "@/lib/format";
import { identiteEntreprise } from "@/lib/identite";
import { moduleOuvert } from "@/lib/modules/garde";
import { nuitsEntre, recapTva } from "@/modules/hotellerie/calcul";
import { aujourdHuiPour } from "@/modules/hotellerie/creation";
import { ficheSejour } from "@/modules/hotellerie/requetes";

export const metadata: Metadata = { title: "Note de chambre" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" });

/**
 * Note de chambre au format A4. Provisoire pendant le séjour, elle devient la
 * facture du séjour une fois le départ soldé.
 */
export default async function ImpressionNoteChambre({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id) || !moduleOuvert("hotellerie")) notFound();
  const session = await exigerEntreprise();
  if (!(await peut("hotellerie.consulter"))) notFound();
  const s = await ficheSejour(session.organizationId, id);
  if (!s || s.statut === "annule") notFound();
  const identite = await identiteEntreprise(session.organizationId);
  const departReel = s.statut === "restitue" && s.departLe ? await aujourdHuiPour(session.organizationId, s.departLe) : null;

  const definitive = s.statut === "restitue";
  const nuits = nuitsEntre(s.arrivee, s.depart);
  const recap = recapTva([
    { montant: s.hebergement, tauxTvaBp: s.chambre.tauxTva, nature: "service" },
    ...s.prestations.map((p) => ({ montant: p.montant, tauxTvaBp: p.tauxTva, nature: p.nature })),
  ]);

  return (
    <main className="min-h-dvh bg-[var(--fond)] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <BoutonImprimer />
      </div>
      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] text-[10.5pt] leading-snug text-black shadow print:shadow-none">
        <EnTeteDocument identite={identite}>
          <p className="text-xl font-bold uppercase">{definitive ? "Facture de séjour" : "Note provisoire"}</p>
          <p className="font-mono">{s.numero}</p>
          <p>Chambre {s.chambre.code}</p>
        </EnTeteDocument>

        <section className="mt-4 grid grid-cols-2 gap-4 rounded border border-black/20 p-3">
          <div>
            <p className="font-semibold">{s.client.nom}</p>
            {s.client.telephone && <p>{s.client.telephone}</p>}
          </div>
          <div className="text-right">
            <p>Arrivée : {date(s.arrivee)}</p>
            {/* Un client parti le jour de son arrivée paie sa nuit, mais il est parti ce jour-là. */}
            <p>Départ : {date(departReel ?? s.depart)}</p>
            <p>
              {nuits} nuit{nuits > 1 ? "s" : ""} · {s.adultes + s.enfants} personne{s.adultes + s.enfants > 1 ? "s" : ""}
            </p>
          </div>
        </section>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y border-black/40 text-left text-[9pt] uppercase">
              <th className="py-1.5">Date</th>
              <th className="py-1.5">Désignation</th>
              <th className="py-1.5 text-right">Qté</th>
              <th className="py-1.5 text-right">Prix TTC</th>
              <th className="py-1.5 text-right">Montant TTC</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black/10">
              <td className="py-1.5 tabular-nums">{date(s.arrivee)}</td>
              <td className="py-1.5">
                Hébergement, chambre {s.chambre.code}
                {s.chambre.categorie ? ` (${s.chambre.categorie})` : ""}
              </td>
              <td className="py-1.5 text-right tabular-nums">{nuits}</td>
              <td className="py-1.5 text-right tabular-nums">{s.prixNuit !== null ? fmt(s.prixNuit) : ""}</td>
              <td className="py-1.5 text-right tabular-nums">{fmt(s.hebergement)}</td>
            </tr>
            {s.prestations.map((p) => (
              <tr key={p.id} className="border-b border-black/10">
                <td className="py-1.5 tabular-nums">{date(p.jour)}</td>
                <td className="py-1.5">{p.libelle}</td>
                <td className="py-1.5 text-right tabular-nums">{p.quantite}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(p.prixUnitaire)}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(p.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-[85mm] tabular-nums">
          {recap.map((r) => (
            <p key={r.tauxTvaBp} className="flex justify-between text-[9.5pt] text-black/70">
              <span>{r.tauxTvaBp > 0 ? `HT ${fmt(r.ht)} · TVA ${fmtTauxBp(r.tauxTvaBp)}` : "Exonéré de TVA"}</span>
              <span>{r.tauxTvaBp > 0 ? fmt(r.tva) : fmt(r.ttc)}</span>
            </p>
          ))}
          <p className="mt-1 flex justify-between border-t-2 border-black pt-2 text-base font-bold">
            <span>Total TTC</span>
            <span>{fmt(s.note.total)} FCFA</span>
          </p>
          {s.acomptes.map((a) => (
            <p key={a.id} className="flex justify-between">
              <span>Acompte {a.numero} du {date(a.jour)}</span>
              <span>− {fmt(a.montant)}</span>
            </p>
          ))}
          <p className="mt-1 flex justify-between font-semibold">
            <span>{definitive ? (s.note.reste < 0 ? "Rendu au client" : "Réglé au départ") : s.note.reste < 0 ? "À rendre" : "Reste à payer"}</span>
            <span>{fmt(Math.abs(s.note.reste))} FCFA</span>
          </p>
        </div>

        {!definitive && <p className="mt-6 text-[9pt] text-black/60">Note arrêtée au jour de l&apos;impression ; le séjour n&apos;est pas encore soldé.</p>}
        <PiedDocument identite={identite} />
      </article>
    </main>
  );
}
