import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BoutonFichier, BoutonGeste, Invitation } from "@/components/marches/elements";
import { FormulaireRepliable } from "@/components/ui/operations";
import { CLASSE_CHAMP, Champ, Pastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt } from "@/lib/format";
import { annulerConsultation, attribuer, cloturerConsultation, enregistrerOffre } from "@/modules/marches/actions";
import { consultationDe } from "@/modules/marches/creation";
import { listerTiers } from "@/modules/tiers/requetes";

export const metadata: Metadata = { title: "Consultation" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUT_OFFRE = { invitee: "Invitée", recue: "Reçue", retenue: "Retenue", ecartee: "Écartée" } as const;

/** Une consultation : les invités, leurs offres classées, l'attribution. */
export default async function PageConsultation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await exigerEntreprise();
  const detail = await consultationDe(session.organizationId, id);
  if (!detail) notFound();
  const { consultation: c, offres } = detail;
  const gerer = await peut("marches.consultation.gerer");
  const ouverte = c.statut === "brouillon" || c.statut === "ouverte";
  const attribuable = c.statut === "ouverte" || c.statut === "cloturee";
  const dejaInvites = new Set(offres.map((o) => o.tiersId));
  const fournisseurs = gerer && ouverte ? (await listerTiers(session.organizationId, "fournisseur")).filter((t) => !dejaInvites.has(t.id)) : [];
  const poidsPrix = Math.round(c.poidsPrixBp / 100);

  return (
    <>
      <Link href="/marches/consultations" className="mb-3 inline-block text-sm text-[var(--encre-douce)] hover:underline">
        ← Consultations
      </Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{c.objet}</h1>
          <p className="mt-1 text-sm text-[var(--encre-douce)]">
            <span className="chiffres">{c.numero}</span>
            {c.dateLimite && ` · remise avant le ${c.dateLimite.split("-").reverse().join("/")}`}
            {c.budget !== null && ` · budget ${fmt(c.budget)} F`}
            {` · prix ${poidsPrix} %, technique ${100 - poidsPrix} %`}
          </p>
          {c.description && <p className="mt-1 text-sm">{c.description}</p>}
          {c.criteres && <p className="mt-0.5 text-xs text-[var(--encre-faible)]">Critères : {c.criteres}</p>}
        </div>
        {gerer && (
          <div className="flex flex-wrap gap-2">
            {c.statut === "ouverte" && <BoutonGeste libelle="Clore la réception" confirmation="Clore la réception des offres ?" action={cloturerConsultation.bind(null, c.id)} />}
            {(ouverte || c.statut === "cloturee") && <BoutonGeste libelle="Annuler" ton="danger" confirmation="Annuler cette consultation ?" action={annulerConsultation.bind(null, c.id)} />}
          </div>
        )}
      </header>

      {gerer && ouverte && (
        <section className="mb-6 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Inviter des fournisseurs</h2>
          <Invitation consultationId={c.id} fournisseurs={fournisseurs.map((t) => ({ id: t.id, nom: t.nom, email: Boolean(t.email), telephone: Boolean(t.telephone) }))} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold">Offres</h2>
        {offres.length === 0 ? (
          <p className="text-sm text-[var(--encre-faible)]">Aucun fournisseur invité pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-3">
            {offres.map((o) => (
              <li key={o.id} className={`rounded-xl border bg-[var(--surface)] p-4 ${o.statut === "retenue" ? "border-valide-500" : "border-[var(--filet)]"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {o.rang && <span className="chiffres flex size-6 items-center justify-center rounded-full bg-marque-50 text-xs text-marque-600">{o.rang}</span>}
                      {o.fournisseur}
                      <Pastille ton={o.statut === "retenue" ? "valide" : o.statut === "ecartee" ? "neutre" : o.statut === "recue" ? "marque" : "alerte"}>{STATUT_OFFRE[o.statut]}</Pastille>
                    </p>
                    {o.statut !== "invitee" && (
                      <p className="mt-1 text-sm">
                        <span className="chiffres font-semibold">{o.montant !== null ? `${fmt(o.montant)} F` : "—"}</span>
                        {o.delaiJours !== null && <span className="text-[var(--encre-douce)]"> · délai {o.delaiJours} j</span>}
                        {o.noteTechnique !== null && <span className="text-[var(--encre-douce)]"> · technique {o.noteTechnique}/100</span>}
                        {o.note !== null && <span className="font-semibold text-marque-600"> · note {o.note}/100</span>}
                      </p>
                    )}
                    {o.commentaire && <p className="mt-0.5 text-xs text-[var(--encre-douce)]">{o.commentaire}</p>}
                    {o.nomFichier && <BoutonFichier nature="offre" id={o.id} nom={o.nomFichier} />}
                  </div>
                  {gerer && (
                    <div className="flex flex-wrap items-start gap-2">
                      {attribuable && o.statut === "recue" && (
                        <BoutonGeste libelle="Retenir cette offre" ton="principal" confirmation={`Attribuer la consultation à ${o.fournisseur} ? Les autres offres seront écartées.`} action={attribuer.bind(null, o.id)} />
                      )}
                      {attribuable && (o.statut === "invitee" || o.statut === "recue") && (
                        <FormulaireRepliable libelle={o.statut === "invitee" ? "Saisir l'offre" : "Corriger"} titre={`Offre de ${o.fournisseur}`} action={enregistrerOffre.bind(null, o.id)}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Champ libelle="Montant (FCFA)">
                              <input name="montant" required inputMode="numeric" defaultValue={o.montant ?? ""} className={`${CLASSE_CHAMP} chiffres`} />
                            </Champ>
                            <Champ libelle="Délai (jours)">
                              <input name="delaiJours" inputMode="numeric" defaultValue={o.delaiJours ?? ""} className={`${CLASSE_CHAMP} chiffres`} />
                            </Champ>
                            <Champ libelle="Note technique (sur 100)">
                              <input name="noteTechnique" inputMode="numeric" defaultValue={o.noteTechnique ?? ""} className={`${CLASSE_CHAMP} chiffres`} />
                            </Champ>
                            <Champ libelle="Offre reçue (fichier)">
                              <input name="fichier" type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" className="block w-full text-sm" />
                            </Champ>
                            <Champ libelle="Commentaire">
                              <input name="commentaire" defaultValue={o.commentaire ?? ""} className={CLASSE_CHAMP} />
                            </Champ>
                          </div>
                        </FormulaireRepliable>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 max-w-[75ch] text-xs text-[var(--encre-faible)]">
          La note mêle le prix — 100 pour l&apos;offre la moins chère, proportionnellement moins pour les autres — et la note technique, selon le poids annoncé.
          Une offre sans montant n&apos;est pas classée.
        </p>
      </section>
    </>
  );
}
