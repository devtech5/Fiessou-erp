import type { Metadata } from "next";

import { EnTetePage, EtatVide, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { calculerSIG, elementsResultat } from "@/lib/comptabilite/etats";
import { fmt, fmtEntier } from "@/lib/format";
import { exercicesEcrits, soldesParCompte } from "@/modules/comptabilite/requetes";

export const metadata: Metadata = { title: "États financiers" };

/** Les huit classes du plan SYSCOHADA. */
const CLASSES = [
  { numero: "1", intitule: "Ressources durables" },
  { numero: "2", intitule: "Actif immobilisé" },
  { numero: "3", intitule: "Stocks" },
  { numero: "4", intitule: "Tiers" },
  { numero: "5", intitule: "Trésorerie" },
  { numero: "6", intitule: "Charges" },
  { numero: "7", intitule: "Produits" },
  { numero: "8", intitule: "Autres charges et produits" },
];

export default async function PageEtats() {
  const session = await exigerEntreprise();

  const exercices = await exercicesEcrits(session.organizationId);
  const exercice = exercices[0] ?? String(new Date().getFullYear());
  const soldes = await soldesParCompte(session.organizationId, exercice);

  if (soldes.length === 0) {
    return (
      <>
        <EnTetePage titre="États financiers" sousTitre={`Exercice ${exercice}`} />
        <EtatVide
          titre="Rien à présenter pour cet exercice"
          message="Le compte de résultat est la conséquence des écritures, pas un document à remplir. Il apparaîtra dès la première vente encaissée."
        />
      </>
    );
  }

  const sig = calculerSIG(elementsResultat(soldes));

  const parClasse = CLASSES.map((classe) => {
    const comptes = soldes.filter((s) => s.compte.startsWith(classe.numero));
    return {
      ...classe,
      comptes: comptes.length,
      solde: comptes.reduce((somme, s) => somme + (s.debit - s.credit), 0),
    };
  }).filter((classe) => classe.comptes > 0);

  return (
    <>
      <EnTetePage
        titre="États financiers"
        sousTitre={`Compte de résultat SYSCOHADA · exercice ${exercice}`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <section className="overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
          <header className="border-b border-[var(--filet)] px-4 py-3">
            <h2 className="text-sm font-semibold">Soldes intermédiaires de gestion</h2>
            <p className="text-xs text-[var(--encre-faible)]">
              Chaque solde découle du précédent
            </p>
          </header>

          <table className="w-full text-sm">
            <tbody>
              {sig.map((solde) => (
                <tr
                  key={solde.code}
                  className={`border-b border-[var(--filet)] last:border-b-0 ${
                    solde.cle ? "bg-[var(--surface-creuse)]" : ""
                  }`}
                >
                  <td className="chiffres w-12 py-2.5 pl-4 text-xs text-[var(--encre-faible)]">
                    {solde.code}
                  </td>
                  <td
                    className={`py-2.5 pr-3 ${solde.cle ? "font-semibold" : "text-[var(--encre-douce)]"}`}
                  >
                    {solde.libelle}
                  </td>
                  <td
                    className={`chiffres py-2.5 pr-4 text-right ${
                      solde.cle ? "text-base font-bold" : ""
                    } ${solde.montant < 0 && !solde.cle ? "text-[var(--encre-faible)]" : ""} ${
                      solde.cle && solde.montant < 0 ? "text-danger-600" : ""
                    }`}
                  >
                    {solde.montant < 0
                      ? `(${fmt(Math.abs(solde.montant))})`
                      : fmt(solde.montant)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <h2 className="mb-2.5 text-sm font-semibold">Comptes mouvementés</h2>
            <ul className="space-y-1.5 text-sm">
              {parClasse.map((classe) => (
                <li key={classe.numero} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[var(--encre-douce)]">
                    <span className="chiffres mr-1.5 text-xs text-[var(--encre-faible)]">
                      {classe.numero}
                    </span>
                    {classe.intitule}
                  </span>
                  <span className="chiffres shrink-0 text-xs text-[var(--encre-faible)]">
                    {classe.comptes}
                  </span>
                </li>
              ))}
            </ul>
            <p className="chiffres mt-3 border-t border-[var(--filet)] pt-2.5 text-sm font-semibold">
              {fmtEntier(soldes.length)} comptes
            </p>
          </section>

          <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
            <h2 className="mb-2 text-sm font-semibold">Ce qui manque encore</h2>
            {/* Annoncer ce qui n'existe pas vaut mieux que de le faire croire :
                un exploitant qui découvre à la clôture qu'il n'a pas de bilan
                a perdu son exercice. */}
            <ul className="space-y-1.5 text-sm text-[var(--encre-douce)]">
              <li>Bilan — actif et passif</li>
              <li>Tableau de flux de trésorerie</li>
              <li>Notes annexes</li>
            </ul>
            <p className="mt-2.5 text-xs text-[var(--encre-faible)]">
              Ces états supposent les immobilisations et la clôture d&apos;exercice,
              qui viendront avec le module des actifs.
            </p>
          </section>
        </aside>
      </div>

      {/* ------------------------------------------------- balance générale */}
      <section className="mt-6">
        <h2 className="mb-2.5 text-base font-semibold">Balance générale</h2>
        <p className="mb-3 text-sm text-[var(--encre-douce)]">
          Tous les comptes mouvementés de l&apos;exercice. C&apos;est l&apos;état
          que réclame un expert-comptable, et celui qui permet de rattacher
          chaque solde aux pièces qui l&apos;ont produit.
        </p>

        <Tableau>
          <thead>
            <tr>
              <Th>Compte</Th>
              <Th>Intitulé</Th>
              <Th aligne="droite">Débit</Th>
              <Th aligne="droite">Crédit</Th>
              <Th aligne="droite">Solde</Th>
            </tr>
          </thead>
          <tbody>
            {soldes.map((solde) => {
              const net = solde.debit - solde.credit;

              return (
                <tr key={solde.compte}>
                  <Td chiffres fort>
                    {solde.compte}
                  </Td>
                  <Td>{solde.libelle}</Td>
                  <Td aligne="droite" chiffres>
                    {solde.debit === 0 ? "—" : fmt(solde.debit)}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {solde.credit === 0 ? "—" : fmt(solde.credit)}
                  </Td>
                  <Td aligne="droite" chiffres fort>
                    {net < 0 ? `(${fmt(Math.abs(net))})` : fmt(net)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tableau>
      </section>
    </>
  );
}
