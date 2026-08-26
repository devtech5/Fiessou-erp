import type { Metadata } from "next";

import {
  CarteIndicateur,
  EnTetePage,
  EtatVide,
  Pastille,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { JOURNAUX } from "@/lib/comptabilite/ecritures";
import {
  calculerSIG,
  elementsResultat,
  positionComptable,
} from "@/lib/comptabilite/etats";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import {
  activiteParJournal,
  etatLettrage,
  exercicesEcrits,
  soldesParCompte,
} from "@/modules/comptabilite/requetes";

export const metadata: Metadata = { title: "Comptabilité" };

export default async function PageComptabilite() {
  const session = await exigerEntreprise();

  // L'exercice affiché est le dernier écrit. Une entreprise qui n'a jamais
  // comptabilisé n'en a aucun : on prend l'année civile plutôt que de laisser
  // l'écran sans repère.
  const exercices = await exercicesEcrits(session.organizationId);
  const exercice = exercices[0] ?? String(new Date().getFullYear());

  const [soldes, journaux, lettrage] = await Promise.all([
    soldesParCompte(session.organizationId, exercice),
    activiteParJournal(session.organizationId, exercice),
    etatLettrage(session.organizationId),
  ]);

  const position = positionComptable(soldes);
  const sig = calculerSIG(elementsResultat(soldes));
  const resultatNet = sig.find((s) => s.code === "XI")!.montant;

  const comptesTresorerie = soldes.filter((s) =>
    ["52", "53", "57"].some((prefixe) => s.compte.startsWith(prefixe)),
  );

  // Le contrôle qui précède tous les autres : une balance qui ne tombe pas
  // juste rend faux tout ce qui en découle.
  const totalDebit = soldes.reduce((somme, s) => somme + s.debit, 0);
  const totalCredit = soldes.reduce((somme, s) => somme + s.credit, 0);
  const ecartBalance = totalDebit - totalCredit;

  const parJournal = new Map(journaux.map((j) => [j.journal, j]));
  const ecrituresTotal = journaux.reduce((somme, j) => somme + j.ecritures, 0);

  if (soldes.length === 0) {
    return (
      <>
        <EnTetePage titre="Comptabilité" sousTitre={`Exercice ${exercice}`} />
        <EtatVide
          titre="Aucune écriture pour cet exercice"
          message="La comptabilité se remplit toute seule : un ticket encaissé pose son écriture dans la même transaction que la vente. Encaissez en caisse, et le journal se garnit."
        />
      </>
    );
  }

  return (
    <>
      <EnTetePage
        titre="Comptabilité"
        sousTitre={`Exercice ${exercice} · ${fmtEntier(ecrituresTotal)} écriture${ecrituresTotal > 1 ? "s" : ""}`}
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Trésorerie"
          valeur={fmtCompact(position.tresorerie)}
          unite="FCFA"
          ton="valide"
          precision="Banque, caisse et mobile money"
        />
        <CarteIndicateur
          libelle="Créances clients"
          valeur={fmtCompact(position.creancesClients)}
          unite="FCFA"
          precision="Compte 41"
          href="/commercial"
        />
        <CarteIndicateur
          libelle="Dettes fournisseurs"
          valeur={fmtCompact(position.dettesFournisseurs)}
          unite="FCFA"
          ton="alerte"
          precision="Compte 40"
          href="/commercial/fournisseurs"
        />
        <CarteIndicateur
          libelle="Résultat net"
          valeur={fmtCompact(resultatNet)}
          unite="FCFA"
          ton={resultatNet >= 0 ? "valide" : "danger"}
          precision={resultatNet >= 0 ? "Bénéfice" : "Perte"}
          href="/comptabilite/etats"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------- trésorerie */}
        <section>
          <h2 className="mb-2.5 text-base font-semibold">Comptes de trésorerie</h2>
          {comptesTresorerie.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--filet)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--encre-douce)]">
              Aucun mouvement de trésorerie sur l&apos;exercice.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
              {comptesTresorerie.map((compte) => (
                <li
                  key={compte.compte}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="chiffres block text-xs text-[var(--encre-faible)]">
                      {compte.compte}
                    </span>
                    <span className="block truncate text-sm font-medium">
                      {compte.libelle}
                    </span>
                  </span>
                  <span className="chiffres shrink-0 text-sm font-bold">
                    {fmt(compte.debit - compte.credit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------------------------------------------- journaux */}
        <section>
          <h2 className="mb-2.5 text-base font-semibold">Journaux</h2>
          <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
            {JOURNAUX.map((journal) => {
              const activite = parJournal.get(journal.code);

              return (
                <li
                  key={journal.code}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-semibold">
                      {journal.code} — {journal.libelle}
                    </span>
                    <span className="block truncate text-xs text-[var(--encre-faible)]">
                      {journal.contrepartie
                        ? `Contrepartie ${journal.contrepartie}`
                        : "Les deux côtés se saisissent"}
                    </span>
                  </span>
                  <span
                    className={`chiffres shrink-0 text-xs ${
                      activite ? "text-[var(--encre-douce)]" : "text-[var(--encre-faible)]"
                    }`}
                  >
                    {activite ? fmtEntier(activite.ecritures) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ----------------------------------------------------- lettrage */}
        <section>
          <h2 className="mb-2.5 text-base font-semibold">Lettrage</h2>
          <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <p className="text-sm font-medium">41 — Clients</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[var(--encre-faible)]">Lettrées</p>
                <p className="chiffres text-xl font-bold text-valide-600">
                  {fmtEntier(lettrage.lettrees)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--encre-faible)]">Non lettrées</p>
                <p className="chiffres text-xl font-bold text-alerte-600">
                  {fmtEntier(lettrage.nonLettrees)}
                </p>
              </div>
            </div>

            <p className="chiffres mt-3 text-xs text-[var(--encre-faible)]">
              Solde ouvert {fmt(lettrage.soldeOuvert)} FCFA
            </p>

            <p className="mt-3 rounded-lg bg-[var(--surface-creuse)] px-3 py-2.5 text-sm text-[var(--encre-douce)]">
              Une ligne lettrée est rapprochée de son règlement, donc soldée. Ce
              qui reste ouvert est ce que les clients doivent encore.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------ balance */}
        <section>
          <h2 className="mb-2.5 text-base font-semibold">Contrôle de la balance</h2>
          <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-sm text-[var(--encre-douce)]">
                {fmtEntier(soldes.length)} comptes mouvementés
              </p>
              {ecartBalance === 0 ? (
                <Pastille ton="valide">Équilibrée</Pastille>
              ) : (
                <Pastille ton="danger">Écart</Pastille>
              )}
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--encre-douce)]">Total des débits</dt>
                <dd className="chiffres font-semibold">{fmt(totalDebit)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--encre-douce)]">Total des crédits</dt>
                <dd className="chiffres font-semibold">{fmt(totalCredit)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-sm text-[var(--encre-douce)]">
              {ecartBalance === 0
                ? "Chaque écriture pèse autant au débit qu'au crédit. C'est le contrôle qui précède tous les autres : une balance qui ne tombe pas juste rend faux tout ce qui en découle."
                : `Écart de ${fmt(Math.abs(ecartBalance))} FCFA. Une écriture a été posée hors du moteur, ou une ligne a été modifiée en base.`}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
