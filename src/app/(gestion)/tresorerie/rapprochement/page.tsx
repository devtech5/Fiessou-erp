import type { Metadata } from "next";
import Link from "next/link";

import { AccesRefuse } from "@/components/coque/acces-refuse";
import { FormulaireRepliable } from "@/components/ui/operations";
import { CarteIndicateur, EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtEntier } from "@/lib/format";
import { importerReleve } from "@/modules/tresorerie/actions";
import { ecrituresNonPointees, listerComptes, releveDuCompte } from "@/modules/tresorerie/requetes";

import { libelleChamp } from "../champs";
import { Releve } from "./releve";

export const metadata: Metadata = { title: "Rapprochement bancaire" };

const signe = (n: number) => `${n > 0 ? "+ " : n < 0 ? "− " : ""}${fmt(Math.abs(n))}`;

/**
 * Rapprochement bancaire : ce que la banque a passé, face à ce que la
 * comptabilité a enregistré. Ce qui reste non pointé d'un côté ou de l'autre
 * est soit un décalage de date, soit un oubli — frais, chèque non encaissé.
 */
export default async function PageRapprochement({ searchParams }: PageProps<"/tresorerie/rapprochement">) {
  const session = await exigerEntreprise();
  if (!(await peut("tresorerie.rapprocher"))) return <AccesRefuse droit="tresorerie.rapprocher" />;

  const banques = (await listerComptes(session.organizationId)).filter((c) => c.nature === "banque" && c.actif);
  const { compte: demande } = await searchParams;
  const compte = banques.find((b) => b.id === demande) ?? banques[0];

  if (!compte) {
    return (
      <>
        <EnTetePage titre="Rapprochement bancaire" />
        <EtatVide titre="Aucun compte bancaire" message="Déclarez votre banque dans l'onglet Comptes, puis importez son relevé ici." />
      </>
    );
  }

  const [releve, libres] = await Promise.all([
    releveDuCompte(session.organizationId, compte.id),
    ecrituresNonPointees(session.organizationId, compte.compte),
  ]);
  const nonPointees = releve.filter((l) => !l.pointee);
  const pointees = releve.length - nonPointees.length;

  return (
    <>
      <EnTetePage
        titre="Rapprochement bancaire"
        sousTitre={`${compte.nom} — compte ${compte.compte}`}
        actions={
          <FormulaireRepliable libelle="Importer un relevé" titre={`Relevé ${compte.nom}`} action={importerReleve}>
            <input type="hidden" name="compteId" value={compte.id} />
            <label className="block">
              <span className={libelleChamp}>Fichier CSV exporté depuis la banque en ligne</span>
              <input type="file" name="releve" required accept=".csv,text/csv,text/plain" className="block w-full text-sm" />
            </label>
            <p className="mt-2 text-xs text-[var(--encre-faible)]">
              Il faut une colonne Date, une colonne Libellé, et soit une colonne Montant, soit deux colonnes Débit et
              Crédit. Séparateur point-virgule, virgule ou tabulation. Les lignes déjà importées ne sont pas reprises,
              et chaque ligne dont le montant et la date correspondent à une écriture est pointée aussitôt.
            </p>
          </FormulaireRepliable>
        }
      />

      {banques.length > 1 && (
        <nav aria-label="Comptes bancaires" className="mb-4 flex gap-1.5 overflow-x-auto pb-0.5">
          {banques.map((b) => (
            <Link
              key={b.id}
              href={`/tresorerie/rapprochement?compte=${b.id}`}
              aria-current={b.id === compte.id ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
                b.id === compte.id ? "bg-marque-600 text-white" : "bg-[var(--surface-creuse)] text-[var(--encre-douce)]"
              }`}
            >
              {b.nom}
            </Link>
          ))}
        </nav>
      )}

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur libelle="Solde comptable" valeur={fmt(compte.solde)} unite="FCFA" precision="Somme des écritures du compte" />
        <CarteIndicateur libelle="Lignes de relevé" valeur={fmtEntier(releve.length)} precision={`${fmtEntier(pointees)} pointée${pointees > 1 ? "s" : ""}`} />
        <CarteIndicateur
          libelle="Relevé non pointé"
          valeur={fmtEntier(nonPointees.length)}
          ton={nonPointees.length ? "alerte" : "valide"}
          precision={nonPointees.length ? `${signe(nonPointees.reduce((s, l) => s + l.montant, 0))} F passés par la banque seule` : "Tout est pointé"}
        />
        <CarteIndicateur
          libelle="Écritures non pointées"
          valeur={fmtEntier(libres.length)}
          ton={libres.length ? "alerte" : "valide"}
          precision={libres.length ? `${signe(libres.reduce((s, l) => s + l.montant, 0))} F pas encore vus par la banque` : "Tout est pointé"}
        />
      </section>

      {releve.length === 0 && libres.length === 0 ? (
        <EtatVide titre="Rien à rapprocher" message="Importez le relevé de la banque : ses lignes seront pointées face aux écritures du compte." />
      ) : (
        <Releve compteId={compte.id} releve={releve} libres={libres} />
      )}
    </>
  );
}
