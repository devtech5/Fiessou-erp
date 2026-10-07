import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CarteIndicateur, CLASSE_CHAMP_COMPACT, EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt } from "@/lib/format";
import { listerTiers } from "@/modules/tiers/requetes";
import { LIBELLE_NATURE_COMPTE } from "@/modules/tresorerie/calcul";
import { listerComptes } from "@/modules/tresorerie/requetes";
import { releveCompte } from "@/modules/tresorerie/requetes-mouvements";

import { FormulaireMouvement } from "./formulaire";
import { Releve } from "./releve";

export const metadata: Metadata = { title: "Mouvements" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const LIEN_SECONDAIRE =
  "h-cible inline-flex items-center rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]";

/**
 * Mouvements d'un compte : le relevé de tout ce qui l'a touché, et la saisie
 * de ce qui entre ou sort sans facture ni dépense — versement d'un client,
 * ordre de virement à un prestataire, apport, prêt, frais.
 */
export default async function PageMouvements({ searchParams }: { searchParams: Promise<{ compte?: string; du?: string; au?: string }> }) {
  const session = await exigerEntreprise();
  if (!(await peut("tresorerie.consulter"))) redirect("/tresorerie/caisse");

  const params = await searchParams;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const au = params.au && ISO.test(params.au) ? params.au : aujourdhui;
  const du = params.du && ISO.test(params.du) && params.du <= au ? params.du : `${au.slice(0, 7)}-01`;

  const [comptes, saisir, rapprocher] = await Promise.all([
    listerComptes(session.organizationId),
    peut("tresorerie.mouvement.saisir"),
    peut("tresorerie.rapprocher"),
  ]);
  const actifs = comptes.filter((c) => c.actif);
  if (actifs.length === 0) {
    return (
      <>
        <EnTetePage titre="Mouvements" />
        <EtatVide
          titre="Aucun compte de trésorerie"
          message="Déclarez d'abord vos banques, caisses et portefeuilles mobile money dans l'onglet Comptes : chaque mouvement s'enregistre sur l'un d'eux."
          actions={
            <Link href="/tresorerie" className="h-cible inline-flex items-center rounded-lg bg-marque-600 px-3.5 text-sm font-semibold text-white hover:bg-marque-700">
              Déclarer un compte
            </Link>
          }
        />
      </>
    );
  }

  const compte = actifs.find((c) => c.id === params.compte) ?? actifs.find((c) => c.nature === "banque") ?? actifs[0];
  const [releve, clients, fournisseurs] = await Promise.all([
    releveCompte(session.organizationId, compte.id, du, au),
    saisir ? listerTiers(session.organizationId, "client") : Promise.resolve([]),
    saisir ? listerTiers(session.organizationId, "fournisseur") : Promise.resolve([]),
  ]);
  if (!releve) redirect("/tresorerie/mouvements");
  const banque = compte.nature === "banque";

  return (
    <>
      <EnTetePage
        titre="Mouvements"
        sousTitre="Tout ce qui entre et sort d'un compte, et la saisie de ce qui ne passe ni par une facture ni par une dépense"
        actions={
          <>
            <Link href="/tresorerie/virements" className={LIEN_SECONDAIRE}>
              Virements internes
            </Link>
            {banque && rapprocher && (
              <Link href={`/tresorerie/rapprochement?compte=${compte.id}`} className={LIEN_SECONDAIRE}>
                Rapprocher avec le relevé
              </Link>
            )}
            {saisir && (
              <FormulaireMouvement
                key={compte.id}
                compteId={compte.id}
                banque={banque}
                clients={clients.map((t) => ({ id: t.id, nom: t.nom }))}
                fournisseurs={fournisseurs.map((t) => ({ id: t.id, nom: t.nom }))}
                aujourdhui={aujourdhui}
              />
            )}
          </>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Compte">
        {actifs.map((c) => (
          <Link
            key={c.id}
            href={`/tresorerie/mouvements?compte=${c.id}&du=${du}&au=${au}`}
            aria-current={c.id === compte.id ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              c.id === compte.id ? "border-marque-600 bg-marque-600 font-semibold text-white" : "border-[var(--filet)] bg-[var(--surface)] hover:bg-[var(--surface-creuse)]"
            }`}
          >
            {c.nom}
            <span className={`ml-1.5 text-xs ${c.id === compte.id ? "text-white/80" : "text-[var(--encre-faible)]"}`}>{LIBELLE_NATURE_COMPTE[c.nature]}</span>
          </Link>
        ))}
      </nav>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/tresorerie/mouvements">
        <input type="hidden" name="compte" value={compte.id} />
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--encre-faible)]">Du</span>
          <input type="date" name="du" defaultValue={du} max={aujourdhui} className={CLASSE_CHAMP_COMPACT} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--encre-faible)]">Au</span>
          <input type="date" name="au" defaultValue={au} max={aujourdhui} className={CLASSE_CHAMP_COMPACT} />
        </label>
        <button type="submit" className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]">
          Afficher
        </button>
      </form>

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur libelle="Solde au début" valeur={fmt(releve.ouverture)} unite="FCFA" />
        <CarteIndicateur libelle="Entrées" valeur={fmt(releve.entrees)} unite="FCFA" ton="valide" />
        <CarteIndicateur libelle="Sorties" valeur={fmt(releve.sorties)} unite="FCFA" ton={releve.sorties > 0 ? "alerte" : "neutre"} />
        <CarteIndicateur
          libelle="Solde à la fin"
          valeur={fmt(releve.cloture)}
          unite="FCFA"
          ton={releve.cloture < 0 ? "danger" : "marque"}
          precision={compte.etablissement ? `${compte.etablissement}${compte.reference ? ` · ${compte.reference}` : ""}` : undefined}
        />
      </section>

      {releve.lignes.length === 0 ? (
        <EtatVide titre="Aucune opération sur la période" message="Changez les dates, ou enregistrez le premier mouvement de ce compte." />
      ) : (
        <Releve lignes={releve.lignes} ouverture={releve.ouverture} annuler={saisir} banque={banque} />
      )}
    </>
  );
}
