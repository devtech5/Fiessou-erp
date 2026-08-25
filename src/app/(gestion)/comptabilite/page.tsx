import type { Metadata } from "next";

import {
  BoutonPrincipal,
  CarteIndicateur,
  EnTetePage,
  Pastille,
} from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import {
  COMPTES_CLES,
  ETAPES_CLOTURE,
  JOURNAUX,
  LETTRAGE,
  calculerSIG,
} from "@/lib/fixtures/comptabilite";

export const metadata: Metadata = { title: "Comptabilité" };

export default function PageComptabilite() {
  const sig = calculerSIG();
  const resultatNet = sig.find((s) => s.code === "XI")!.montant;

  const tresorerie = COMPTES_CLES.filter((c) => c.numero.startsWith("5")).reduce(
    (somme, c) => somme + c.solde,
    0,
  );
  const clients = COMPTES_CLES.find((c) => c.numero === "411")!.solde;
  const fournisseurs = COMPTES_CLES.find((c) => c.numero === "401")!.solde;

  const faites = ETAPES_CLOTURE.filter((e) => e.fait).length;

  return (
    <>
      <EnTetePage
        titre="Comptabilité"
        sousTitre="Exercice 2026 · du 01/01/2026 au 31/12/2026"
        actions={<BoutonPrincipal>Nouvelle écriture</BoutonPrincipal>}
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Trésorerie"
          valeur={fmtCompact(tresorerie)}
          unite="FCFA"
          ton="valide"
          precision="Banque, caisse et mobile money"
        />
        <CarteIndicateur
          libelle="Créances clients"
          valeur={fmtCompact(clients)}
          unite="FCFA"
          precision="Compte 411"
        />
        <CarteIndicateur
          libelle="Dettes fournisseurs"
          valeur={fmtCompact(fournisseurs)}
          unite="FCFA"
          ton="alerte"
          precision="Compte 401"
        />
        <CarteIndicateur
          libelle="Résultat net"
          valeur={fmtCompact(resultatNet)}
          unite="FCFA"
          ton={resultatNet >= 0 ? "valide" : "danger"}
          precision={resultatNet >= 0 ? "Bénéfice" : "Perte"}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------- trésorerie */}
        <section>
          <h2 className="mb-2.5 text-base font-semibold">Comptes de trésorerie</h2>
          <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
            {COMPTES_CLES.filter((c) => c.numero.startsWith("5")).map((compte) => (
              <li
                key={compte.numero}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="chiffres block text-xs text-[var(--encre-faible)]">
                    {compte.numero}
                  </span>
                  <span className="block truncate text-sm font-medium">
                    {compte.intitule}
                  </span>
                </span>
                <span className="chiffres shrink-0 text-sm font-bold">
                  {fmt(compte.solde)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------- journaux */}
        <section>
          <h2 className="mb-2.5 text-base font-semibold">Journaux</h2>
          <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
            {JOURNAUX.map((journal) => (
              <li
                key={journal.code}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="text-sm font-semibold">
                    {journal.code} — {journal.libelle}
                  </span>
                  {/* La contrepartie est déduite du journal : c'est ce qui
                      permet à un non-comptable de ne saisir qu'un seul compte. */}
                  <span className="block truncate text-xs text-[var(--encre-faible)]">
                    Contrepartie {journal.contrepartie}
                  </span>
                </span>
                <span className="chiffres shrink-0 text-xs text-[var(--encre-faible)]">
                  {fmtEntier(journal.ecritures)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------------------------------- lettrage */}
        <section>
          <h2 className="mb-2.5 text-base font-semibold">Lettrage</h2>
          <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <p className="text-sm font-medium">{LETTRAGE.compte}</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[var(--encre-faible)]">Lettrées</p>
                <p className="chiffres text-xl font-bold text-valide-600">
                  {fmtEntier(LETTRAGE.lettrees)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--encre-faible)]">Non lettrées</p>
                <p className="chiffres text-xl font-bold text-alerte-600">
                  {fmtEntier(LETTRAGE.nonLettrees)}
                </p>
              </div>
            </div>

            <p className="chiffres mt-3 text-xs text-[var(--encre-faible)]">
              Solde débit non lettré {fmt(LETTRAGE.soldeDebitNonLettre)} FCFA
            </p>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-creuse)] px-3 py-2.5">
              <span className="text-sm">
                {LETTRAGE.suggestions} rapprochements proposés
              </span>
              <span className="text-sm font-semibold text-marque-600">Vérifier</span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ clôture */}
        <section>
          <h2 className="mb-2.5 text-base font-semibold">Clôture de l&apos;exercice</h2>
          <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-sm text-[var(--encre-douce)]">
                {faites} étape{faites > 1 ? "s" : ""} sur {ETAPES_CLOTURE.length}
              </p>
              <Pastille ton="alerte">En cours</Pastille>
            </div>

            <div
              className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-creuse)]"
              role="progressbar"
              aria-valuenow={faites}
              aria-valuemin={0}
              aria-valuemax={ETAPES_CLOTURE.length}
              aria-label="Avancement de la clôture"
            >
              <div
                className="h-full rounded-full bg-marque-600"
                style={{ width: `${(faites / ETAPES_CLOTURE.length) * 100}%` }}
              />
            </div>

            <ul className="space-y-1.5">
              {ETAPES_CLOTURE.slice(0, 5).map((etape) => (
                <li key={etape.numero} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      etape.fait
                        ? "bg-valide-500 text-white"
                        : "bg-[var(--surface-creuse)] text-[var(--encre-faible)]"
                    }`}
                    aria-hidden
                  >
                    {etape.fait ? "✓" : etape.numero}
                  </span>
                  <span
                    className={
                      etape.fait ? "text-[var(--encre-faible)] line-through" : ""
                    }
                  >
                    {etape.libelle}
                  </span>
                  {!etape.fait && etape.bloquant && (
                    <span className="ml-auto shrink-0">
                      <Pastille ton="danger">Bloquant</Pastille>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
