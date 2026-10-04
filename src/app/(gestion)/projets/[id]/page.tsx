import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CarteIndicateur, EnTetePage, EtatVide, Pastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtCompact } from "@/lib/format";
import { LIBELLE_STATUT_PROJET } from "@/modules/projets/calcul";
import { ficheProjet, membresActifs, type PieceVue } from "@/modules/projets/requetes";
import { listerTiers } from "@/modules/tiers/requetes";

import { FormulaireDepense } from "../formulaire-depense";
import { AjoutPiece, PilotageProjet, RetraitPiece } from "../outils";
import { TableauDepenses } from "../tableau-depenses";

export const metadata: Metadata = { title: "Projet" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const NATURE = { photo: "Photo", preuve_paiement: "Preuve de paiement", facture: "Facture / devis", autre: "Pièce" } as const;

/**
 * Fiche d'un projet : affectation, budget, dépenses tracées, photos et
 * preuves. Tout ce qu'il faut pour rendre compte de l'argent dépensé.
 */
export default async function PageProjet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await exigerEntreprise();

  const [fiche, gerer, approuver, payer, demander, membres, fournisseurs] = await Promise.all([
    ficheProjet(session.organizationId, id),
    peut("projet.gerer"),
    peut("depense.approuver"),
    peut("depense.payer"),
    peut("depense.demander"),
    membresActifs(session.organizationId),
    listerTiers(session.organizationId, "fournisseur"),
  ]);
  if (!fiche) notFound();
  const { projet, depenses, pieces } = fiche;

  const photos = pieces.filter((p) => p.nature === "photo" && p.typeMime.startsWith("image/"));
  const autres = pieces.filter((p) => !photos.includes(p));
  const parDepense = new Map<string, PieceVue[]>();
  for (const p of pieces) if (p.depenseId) parDepense.set(p.depenseId, [...(parDepense.get(p.depenseId) ?? []), p]);
  const ouvert = projet.statut !== "termine" && projet.statut !== "annule";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/projets" className="text-marque-600 hover:underline">
          ← Projets
        </Link>
      </p>
      <EnTetePage
        titre={projet.nom}
        sousTitre={[
          projet.code,
          projet.client ?? "Projet interne",
          projet.debut ? `du ${JOUR.format(new Date(projet.debut))}` : null,
          projet.fin ? `au ${JOUR.format(new Date(projet.fin))}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={<Pastille ton={projet.statut === "en_cours" ? "marque" : "neutre"}>{LIBELLE_STATUT_PROJET[projet.statut]}</Pastille>}
      />
      {projet.description && <p className="mb-4 max-w-[80ch] text-sm text-[var(--encre-douce)]">{projet.description}</p>}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Budget"
          valeur={projet.budget === null ? "—" : fmtCompact(projet.budget)}
          unite={projet.budget === null ? undefined : "FCFA"}
          precision={projet.budget === null ? "Pas de plafond fixé" : undefined}
        />
        <CarteIndicateur
          libelle="Engagé"
          valeur={fmtCompact(projet.suivi.engage)}
          unite="FCFA"
          ton={projet.suivi.reste !== null && projet.suivi.reste < 0 ? "danger" : "marque"}
          precision={projet.suivi.taux !== null ? `${projet.suivi.taux} % du budget` : undefined}
        />
        <CarteIndicateur libelle="Payé" valeur={fmtCompact(projet.suivi.paye)} unite="FCFA" ton="valide" />
        <CarteIndicateur
          libelle={projet.suivi.reste !== null && projet.suivi.reste < 0 ? "Dépassement" : "Reste"}
          valeur={projet.suivi.reste === null ? "—" : fmt(Math.abs(projet.suivi.reste))}
          unite={projet.suivi.reste === null ? undefined : "FCFA"}
          ton={projet.suivi.reste !== null && projet.suivi.reste < 0 ? "danger" : "valide"}
          precision={projet.suivi.enAttente > 0 ? `${fmt(projet.suivi.enAttente)} F en attente d'approbation` : undefined}
        />
      </section>

      {gerer && (
        <section className="mb-6 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Affectation et pilotage</h2>
          <PilotageProjet
            id={projet.id}
            statut={projet.statut}
            responsableUserId={projet.responsableUserId}
            budget={projet.budget}
            membres={membres}
          />
        </section>
      )}
      {!gerer && (
        <p className="mb-6 text-sm text-[var(--encre-douce)]">Responsable : {projet.responsable ?? "non affecté"}</p>
      )}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Photos ({photos.length})</h2>
          {gerer && <AjoutPiece projetId={projet.id} />}
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-[var(--encre-faible)]">
            Aucune photo. Avant, pendant, après : la photo datée est la meilleure preuve de l&apos;avancement.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {/* URL signée et éphémère : l'optimiseur d'images la mettrait en cache au-delà de son expiration. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.legende ?? p.nomFichier} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  </a>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-[var(--surface-creuse)] text-xs text-[var(--encre-faible)]">
                    Dépôt indisponible
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 p-2">
                  <p className="min-w-0 text-xs">
                    <span className="block truncate font-medium">{p.legende ?? p.nomFichier}</span>
                    <span className="text-[var(--encre-faible)]">
                      {JOUR.format(p.depose)}
                      {p.auteur ? ` · ${p.auteur}` : ""}
                    </span>
                  </p>
                  {gerer && <RetraitPiece id={p.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {autres.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Preuves et pièces ({autres.length})</h2>
          <ul className="divide-y divide-[var(--filet)] rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
            {autres.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-marque-600 hover:underline">
                      {p.legende ?? p.nomFichier}
                    </a>
                  ) : (
                    p.legende ?? p.nomFichier
                  )}
                  <span className="block text-xs text-[var(--encre-faible)]">
                    {NATURE[p.nature]}
                    {p.depenseId ? ` · ${depenses.find((d) => d.id === p.depenseId)?.numero ?? "dépense"}` : ""} ·{" "}
                    {JOUR.format(p.depose)}
                    {p.auteur ? ` · ${p.auteur}` : ""}
                  </span>
                </span>
                {gerer && <RetraitPiece id={p.id} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Dépenses ({depenses.length})</h2>
          {demander && ouvert && (
            <FormulaireDepense projets={[]} projetId={projet.id} fournisseurs={fournisseurs.map((f) => ({ id: f.id, nom: f.nom }))} />
          )}
        </div>
        {depenses.length === 0 ? (
          <EtatVide titre="Aucune dépense" message="Les achats de ce projet apparaîtront ici, avec qui les a demandés, approuvés et payés." />
        ) : (
          <TableauDepenses depenses={depenses} pieces={parDepense} droits={{ approuver, payer, demander }} afficherProjet={false} />
        )}
      </section>
    </>
  );
}
