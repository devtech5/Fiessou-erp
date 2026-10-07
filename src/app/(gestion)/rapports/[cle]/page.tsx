import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRefuse } from "@/components/coque/acces-refuse";
import { BoutonImprimer } from "@/components/ui/bouton-imprimer";
import { CLASSE_CHAMP_COMPACT, EtatVide, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { droitsActifs } from "@/lib/droits/garde";
import { identiteEntreprise } from "@/lib/identite";
import { rapport } from "@/lib/rapports/registre";
import { formaterValeur, lirePeriode, periodesRapides, totaux, type ResultatRapport, type TypeColonne } from "@/lib/rapports/types";

export async function generateMetadata({ params }: { params: Promise<{ cle: string }> }): Promise<Metadata> {
  const { cle } = await params;
  return { title: rapport(cle)?.titre ?? "Rapport" };
}

const A_DROITE: readonly TypeColonne[] = ["montant", "entier", "quantite", "taux_bp"];
const dateFr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Un rapport, quel qu'il soit : période, tableau, totaux, impression, export.
 *
 * L'en-tête imprimé porte l'entreprise, le titre, la période et l'heure
 * d'édition : un rapport sorti sur papier doit dire d'où il vient et quand.
 */
export default async function PageRapport({
  params,
  searchParams,
}: {
  params: Promise<{ cle: string }>;
  searchParams: Promise<{ du?: string; au?: string }>;
}) {
  const { cle } = await params;
  const definition = rapport(cle);
  if (!definition) notFound();

  const session = await exigerEntreprise();
  const droits = await droitsActifs();
  if (!droits.has("rapports.consulter")) return <AccesRefuse droit="rapports.consulter" />;
  if (!droits.has(definition.droit)) return <AccesRefuse droit={definition.droit} />;

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const periode = lirePeriode(await searchParams, aujourdhui);
  const situation = definition.periode === "situation";
  if (situation) periode.du = periode.au;

  let resultat: ResultatRapport | null = null;
  let erreur: string | null = null;
  try {
    resultat = await definition.executer(session.organizationId, periode);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    // Un refus écrit pour l'utilisateur passe ; une panne de requête, non.
    erreur = message && !message.startsWith("Failed query") && message.length < 200 ? message : "Le rapport n'a pas pu être calculé.";
    if (erreur !== message) console.error(`Rapport ${cle}`, e);
  }
  const identite = await identiteEntreprise(session.organizationId);
  const sommes = resultat ? totaux(resultat) : {};
  const avecTotaux = resultat !== null && resultat.lignes.length > 0 && Object.keys(sommes).length > 0;
  const requete = situation ? `au=${periode.au}` : `du=${periode.du}&au=${periode.au}`;

  return (
    <div className="print:text-[10pt]">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--encre-faible)] print:hidden">
        <Link href={`/rapports?module=${definition.module}`} className="hover:underline">
          Rapports
        </Link>
        <span aria-hidden>›</span>
        <span>{definition.rubrique}</span>
      </div>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hidden text-sm font-semibold print:block">{identite.nom}</p>
          <h1 className="text-xl font-bold tracking-tight">{definition.titre}</h1>
          <p className="mt-0.5 text-sm text-[var(--encre-douce)]">
            {situation ? `Situation au ${dateFr(periode.au)}` : `Du ${dateFr(periode.du)} au ${dateFr(periode.au)}`}
            <span className="hidden print:inline"> · édité le {dateFr(aujourdhui)}</span>
          </p>
        </div>
        {resultat && resultat.lignes.length > 0 && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <a
              href={`/rapports/${cle}/csv?${requete}`}
              className="h-cible inline-flex items-center rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]"
            >
              Exporter pour Excel
            </a>
            <BoutonImprimer />
          </div>
        )}
      </header>

      <section className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
        {!situation &&
          periodesRapides(aujourdhui).map((p, _i, toutes) => {
            // Le 1er octobre, « ce mois » et « ce trimestre » coïncident : seul le premier s'allume.
            const actif = toutes.find((x) => x.du === periode.du && x.au === periode.au)?.cle === p.cle;
            return (
              <Link
                key={p.cle}
                href={`/rapports/${cle}?du=${p.du}&au=${p.au}`}
                aria-current={actif ? "true" : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  actif ? "border-marque-600 bg-marque-600 font-semibold text-white" : "border-[var(--filet)] bg-[var(--surface)] hover:bg-[var(--surface-creuse)]"
                }`}
              >
                {p.libelle}
              </Link>
            );
          })}
        <form action={`/rapports/${cle}`} className="flex flex-wrap items-end gap-2">
          {!situation && (
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--encre-faible)]">Du</span>
              <input type="date" name="du" defaultValue={periode.du} className={CLASSE_CHAMP_COMPACT} />
            </label>
          )}
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[var(--encre-faible)]">{situation ? "Situation au" : "Au"}</span>
            <input type="date" name="au" defaultValue={periode.au} className={CLASSE_CHAMP_COMPACT} />
          </label>
          <button type="submit" className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]">
            Afficher
          </button>
        </form>
      </section>

      {resultat?.note && <p className="mb-3 text-xs text-[var(--encre-faible)]">{resultat.note}</p>}

      {erreur ? (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600">
          {erreur}
        </p>
      ) : !resultat || resultat.lignes.length === 0 ? (
        <EtatVide titre="Rien sur cette période" message="Aucune donnée ne correspond. Élargissez la période, ou vérifiez que les opérations ont bien été saisies." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              {resultat.colonnes.map((c) => (
                <Th key={c.cle} aligne={A_DROITE.includes(c.type) ? "droite" : "gauche"}>
                  {c.libelle}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultat.lignes.map((l, i) => (
              <tr key={i}>
                {resultat.colonnes.map((c) => (
                  <Td key={c.cle} aligne={A_DROITE.includes(c.type) ? "droite" : "gauche"} chiffres={c.type !== "texte"}>
                    {formaterValeur(l[c.cle] ?? null, c.type)}
                  </Td>
                ))}
              </tr>
            ))}
            {avecTotaux && (
              <tr className="bg-[var(--surface-creuse)]">
                {resultat.colonnes.map((c, i) => (
                  <Td key={c.cle} aligne={A_DROITE.includes(c.type) ? "droite" : "gauche"} chiffres={c.type !== "texte"} fort>
                    {c.cle in sommes ? formaterValeur(sommes[c.cle], c.type) : i === 0 ? `Total · ${resultat.lignes.length} ligne${resultat.lignes.length > 1 ? "s" : ""}` : ""}
                  </Td>
                ))}
              </tr>
            )}
          </tbody>
        </Tableau>
      )}
    </div>
  );
}
