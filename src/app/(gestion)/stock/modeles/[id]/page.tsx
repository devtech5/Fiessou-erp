import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CarteIndicateur, EnTetePage } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt } from "@/lib/format";
import { formaterQuantite } from "@/lib/quantite";
import { modeleDetail } from "@/modules/catalogue/modeles";
import { cleCombinaison } from "@/modules/catalogue/variantes";
import { stocksParArticle } from "@/modules/stock/requetes";

import { AjoutValeurs, PrixVariantes } from "./edition";

export const metadata: Metadata = { title: "Modèle" };

/**
 * Un modèle et ses variantes. À deux axes, le stock se lit en grille — les
 * pointures en lignes, les couleurs en colonnes — : c'est ainsi qu'un
 * vendeur cherche « il me reste du 42 en marron ? ».
 */
export default async function PageModele({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await exigerEntreprise();
  const [detail, stocks, gerer] = await Promise.all([modeleDetail(session.organizationId, id), stocksParArticle(session.organizationId), peut("stock.article.gerer")]);
  if (!detail) notFound();
  const { modele: m, variantes } = detail;
  const stock = (articleId: string) => stocks.get(articleId)?.quantite ?? 0;
  const total = variantes.reduce((s, v) => s + stock(v.id), 0);
  const valeur = variantes.reduce((s, v) => s + (stocks.get(v.id)?.valeur ?? 0), 0);
  const parCle = new Map(variantes.map((v) => [cleCombinaison(v.attributs ?? {}, m.axes), v]));
  const [lignes, colonnes] = m.axes;
  const ruptures = variantes.filter((v) => v.actif && stock(v.id) <= 0).length;

  return (
    <>
      <EnTetePage
        titre={m.designation}
        sousTitre={`${m.reference} · ${m.axes.map((a) => a.nom).join(" × ")}`}
        actions={
          <Link href="/stock/modeles" className="h-cible inline-flex items-center rounded-lg border border-[var(--filet)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]">
            Tous les modèles
          </Link>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur libelle="Variantes" valeur={String(variantes.length)} />
        <CarteIndicateur libelle="En stock" valeur={formaterQuantite(total, m.unite)} precision="Toutes variantes et dépôts" />
        <CarteIndicateur libelle="Valeur du stock" valeur={fmt(valeur)} unite="FCFA" />
        <CarteIndicateur libelle="Variantes en rupture" valeur={String(ruptures)} ton={ruptures > 0 ? "alerte" : "valide"} />
      </section>

      {m.axes.length === 2 && (
        <section className="mb-6 overflow-x-auto rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-[var(--filet)]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--encre-faible)]">
                  {lignes.nom} \ {colonnes.nom}
                </th>
                {colonnes.valeurs.map((c) => (
                  <th key={c} className="px-3 py-2 text-right text-xs font-semibold">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--encre-faible)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.valeurs.map((l) => {
                const cellules = colonnes.valeurs.map((c) => parCle.get(cleCombinaison({ [lignes.nom]: l, [colonnes.nom]: c }, m.axes)));
                return (
                  <tr key={l} className="border-b border-[var(--filet)] last:border-0">
                    <th className="px-3 py-2 text-left font-semibold">{l}</th>
                    {cellules.map((v, i) => (
                      <td key={i} className={`px-3 py-2 text-right ${v && stock(v.id) <= 0 ? "text-danger-600" : ""}`} title={v?.reference}>
                        {v ? formaterQuantite(stock(v.id), m.unite) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-[var(--encre-douce)]">{formaterQuantite(cellules.reduce((s, v) => s + (v ? stock(v.id) : 0), 0), m.unite)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <PrixVariantes
        modeleId={m.id}
        modifiable={gerer}
        variantes={variantes.map((v) => ({ id: v.id, reference: v.reference, libelle: m.axes.map((a) => v.attributs?.[a.nom] ?? "").join(" · "), prixVente: v.prixVente, stock: formaterQuantite(stock(v.id), m.unite), actif: v.actif }))}
      />

      {gerer && <AjoutValeurs modeleId={m.id} axes={m.axes} />}
    </>
  );
}
