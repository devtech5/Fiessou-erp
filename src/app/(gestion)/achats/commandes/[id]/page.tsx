import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EnTetePage, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt } from "@/lib/format";
import { formaterQuantite, type CodeUnite } from "@/lib/quantite";
import { LIBELLE_STATUT_COMMANDE } from "@/modules/achats/calcul";
import { articlesAchetables, commandeDetail, depotsActifs, fournisseursActifs } from "@/modules/achats/requetes";

import { EditeurCommande } from "../../editeur-commande";
import { EditeurFacture } from "../../editeur-facture";
import { EnvoyerAnnuler, FormulaireReception } from "./actions-commande";

export const metadata: Metadata = { title: "Commande fournisseur" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const date = (iso: string) => JOUR.format(new Date(`${iso}T00:00:00Z`));

export default async function PageCommande({ params }: PageProps<"/achats/commandes/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await exigerEntreprise();
  const detail = await commandeDetail(session.organizationId, id);
  if (!detail) notFound();
  const { commande: c, lignes, receptions, factures } = detail;

  const [gerer, receptionner, facturer] = await Promise.all([
    peut("achats.commande.gerer"),
    peut("achats.reception.saisir"),
    peut("achats.facture.saisir"),
  ]);
  const [articles, depots, fournisseurs] = await Promise.all([
    articlesAchetables(session.organizationId),
    depotsActifs(session.organizationId),
    fournisseursActifs(session.organizationId),
  ]);
  const unites = new Map(articles.map((a) => [a.id, a.unite as CodeUnite]));
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const aRecevoir = lignes.filter((l) => l.quantite - l.recue > 0);
  const aFacturer = lignes.filter((l) => l.recue - l.facturee > 0);
  const enCours = c.statut === "envoyee" || c.statut === "partielle";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/achats" className="text-marque-600 hover:underline">
          ← Commandes
        </Link>
      </p>
      <EnTetePage
        titre={`Commande ${c.numero}`}
        sousTitre={`${c.fournisseurNom} · ${date(c.dateCommande)}${c.livraisonPrevue ? ` · livraison attendue le ${date(c.livraisonPrevue)}` : ""}${c.depot ? ` · ${c.depot}` : ""}`}
        actions={
          <>
            <Link href={`/imprimer/commande/${c.id}`} className="h-cible inline-flex items-center rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]">
              Imprimer le bon
            </Link>
            {gerer && <EnvoyerAnnuler commandeId={c.id} envoyable={c.statut === "brouillon"} annulable={c.statut !== "annulee" && receptions.length === 0 && factures.every((f) => f.statut === "annulee")} />}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Pastille ton={c.statut === "recue" ? "valide" : c.statut === "annulee" ? "danger" : c.statut === "partielle" ? "alerte" : c.statut === "envoyee" ? "marque" : "neutre"}>
          {LIBELLE_STATUT_COMMANDE[c.statut]}
        </Pastille>
        {c.motifAnnulation && <span className="text-sm text-danger-600">Annulée — {c.motifAnnulation}</span>}
        {c.notes && <span className="text-sm text-[var(--encre-douce)]">{c.notes}</span>}
      </div>

      {gerer && c.statut === "brouillon" && (
        <EditeurCommande
          fournisseurs={fournisseurs}
          depots={depots}
          articles={articles}
          aujourdhui={aujourdhui}
          initiale={{
            id: c.id,
            fournisseurId: c.fournisseurId,
            depotId: c.depotId,
            dateCommande: c.dateCommande,
            livraisonPrevue: c.livraisonPrevue,
            notes: c.notes,
            lignes: lignes.map((l) => ({ articleId: l.articleId, designation: l.designation, quantite: l.quantite, prixUnitaireHt: l.prixUnitaireHt, tauxTva: l.tauxTva, compteAchat: l.compteAchat })),
          }}
        />
      )}

      {(c.statut !== "brouillon" || !gerer) && (
        <section className="mb-6">
          <h2 className="mb-2 text-base font-semibold">Lignes</h2>
          <Tableau>
            <thead>
              <tr>
                <Th>Désignation</Th>
                <Th aligne="droite">Commandé</Th>
                <Th aligne="droite">Reçu</Th>
                <Th aligne="droite">Facturé</Th>
                <Th aligne="droite">Prix HT</Th>
                <Th aligne="droite">TVA</Th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const u = l.articleId ? (unites.get(l.articleId) ?? "piece") : "piece";
                return (
                  <tr key={l.id}>
                    <Td>{l.designation}</Td>
                    <Td aligne="droite" chiffres>{formaterQuantite(l.quantite, u)}</Td>
                    <Td aligne="droite" chiffres>
                      <span className={l.recue >= l.quantite ? "text-valide-600" : l.recue > 0 ? "text-alerte-600" : ""}>{formaterQuantite(l.recue, u)}</span>
                    </Td>
                    <Td aligne="droite" chiffres>{formaterQuantite(l.facturee, u)}</Td>
                    <Td aligne="droite" chiffres>{fmt(l.prixUnitaireHt)}</Td>
                    <Td aligne="droite" chiffres>{l.tauxTva / 100} %</Td>
                  </tr>
                );
              })}
            </tbody>
          </Tableau>
          <p className="chiffres mt-2 text-right text-sm">
            HT <strong>{fmt(c.totalHt)}</strong> · TVA <strong>{fmt(c.totalTva)}</strong> · TTC <strong className="text-base">{fmt(c.totalTtc)} F</strong>
          </p>
        </section>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {receptionner && enCours && aRecevoir.length > 0 && (
          <FormulaireReception
            commandeId={c.id}
            lignes={aRecevoir.map((l) => ({ id: l.id, designation: l.designation, unite: l.articleId ? (unites.get(l.articleId) ?? "piece") : "piece", reste: l.quantite - l.recue }))}
            depots={depots}
            depotParDefaut={c.depotId}
            aujourdhui={aujourdhui}
          />
        )}
        {facturer && aFacturer.length > 0 && (
          <EditeurFacture
            fournisseurs={fournisseurs}
            fournisseurFixe={c.fournisseurId}
            commandeId={c.id}
            articles={articles}
            aujourdhui={aujourdhui}
            libelleBouton="Saisir la facture du fournisseur"
            references={aFacturer.map((l) => ({ ligneCommandeId: l.id, designation: l.designation, recueNonFacturee: l.recue - l.facturee, prixCommande: l.prixUnitaireHt }))}
            lignesInitiales={aFacturer.map((l) => ({
              cle: `f-${l.id}`,
              articleId: l.articleId,
              ligneCommandeId: l.id,
              designation: l.designation,
              quantite: String((l.recue - l.facturee) / 1000),
              prix: String(l.prixUnitaireHt),
              tva: String(l.tauxTva / 100),
              compteAchat: l.compteAchat,
            }))}
          />
        )}
      </div>

      {receptions.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-base font-semibold">Réceptions</h2>
          <ul className="space-y-1 text-sm">
            {receptions.map((r) => (
              <li key={r.id} className="chiffres">
                <strong>{r.numero}</strong> — {date(r.date_reception)} · {r.depot} · {r.lignes} ligne{r.lignes > 1 ? "s" : ""}
                {r.bordereau && ` · bordereau ${r.bordereau}`}
                {r.auteur && ` · ${r.auteur}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {factures.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">Factures</h2>
          <ul className="space-y-1 text-sm">
            {factures.map((f) => (
              <li key={f.id} className="chiffres">
                <Link href="/achats/factures" className="font-semibold text-marque-600 hover:underline">
                  {f.numero}
                </Link>{" "}
                — n° fournisseur {f.reference} · {date(f.dateFacture)} · {fmt(f.totalTtc)} F {f.statut === "annulee" && <Pastille ton="danger">Annulée</Pastille>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
