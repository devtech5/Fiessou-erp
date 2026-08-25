"use client";

import { useMemo, useState } from "react";

import { BoutonPrincipal, BoutonSecondaire, Pastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import {
  CLIENTS,
  DOCUMENTS,
  LIBELLE_STATUT,
  totalTTC,
  type ClientDemo,
  type StatutDocument,
} from "@/lib/fixtures/gestion";

const TON_STATUT: Record<StatutDocument, "neutre" | "valide" | "alerte" | "danger" | "marque"> = {
  brouillon: "neutre",
  envoye: "marque",
  paye: "valide",
  en_retard: "danger",
  accepte: "valide",
  refuse: "danger",
  converti: "valide",
};

/**
 * Fichier clients avec panneau latéral.
 *
 * Le panneau est le seul emprunt franc au concurrent : sélectionner un client
 * ouvre son historique et ses actions sans quitter la liste. Sur un fichier de
 * plusieurs centaines de tiers, cela évite l'aller-retour permanent entre la
 * liste et la fiche.
 */
export function ListeClients() {
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<ClientDemo | null>(CLIENTS[0]);

  const resultats = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return CLIENTS;
    return CLIENTS.filter(
      (client) =>
        client.nom.toLowerCase().includes(terme) ||
        client.telephone.includes(terme) ||
        client.ncc?.toLowerCase().includes(terme),
    );
  }, [recherche]);

  const documents = selection
    ? DOCUMENTS.filter((doc) => doc.client === selection.nom)
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,380px)]">
      {/* ------------------------------------------------------- la liste */}
      <div className="min-w-0">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Nom, téléphone ou numéro de compte contribuable"
          className="h-cible mb-3 w-full rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm outline-none focus:border-marque-500"
        />

        <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
          {resultats.map((client) => {
            const actif = selection?.id === client.id;
            return (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => setSelection(client)}
                  aria-current={actif ? "true" : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                    actif ? "bg-[var(--surface-creuse)]" : "hover:bg-[var(--surface-creuse)]"
                  }`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marque-600 text-sm font-bold text-white">
                    {client.nom.charAt(0)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {client.nom}
                    </span>
                    <span className="chiffres block truncate text-xs text-[var(--encre-faible)]">
                      {client.telephone}
                    </span>
                  </span>

                  {client.encours > 0 && (
                    <span className="shrink-0 text-right">
                      <span className="chiffres block text-sm font-semibold text-alerte-600">
                        {fmt(client.encours)}
                      </span>
                      <span className="block text-[11px] text-[var(--encre-faible)]">
                        encours
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {resultats.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--encre-faible)]">
            Aucun client ne correspond.
          </p>
        )}
      </div>

      {/* ----------------------------------------------------- le panneau */}
      {selection && (
        <aside className="h-fit rounded-xl border border-[var(--filet)] bg-[var(--surface)] lg:sticky lg:top-6">
          <header className="border-b border-[var(--filet)] p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold leading-snug">{selection.nom}</h2>
              <Pastille>{selection.type}</Pastille>
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--encre-faible)]">Téléphone</dt>
                <dd className="chiffres">{selection.telephone}</dd>
              </div>
              {selection.email && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--encre-faible)]">E-mail</dt>
                  <dd className="truncate">{selection.email}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--encre-faible)]">Ville</dt>
                <dd>{selection.ville}</dd>
              </div>
              {/* Identifiant fiscal ivoirien. Le libellé suit le pays de
                  l'entreprise : jamais « NINEA » codé en dur. */}
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--encre-faible)]">N° compte contribuable</dt>
                <dd className="chiffres text-right">{selection.ncc ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--encre-faible)]">Compte auxiliaire</dt>
                <dd className="chiffres">{selection.compteAuxiliaire}</dd>
              </div>
            </dl>
          </header>

          <div className="grid grid-cols-2 divide-x divide-[var(--filet)] border-b border-[var(--filet)]">
            <div className="p-4">
              <p className="text-xs text-[var(--encre-faible)]">Chiffre d&apos;affaires</p>
              <p className="chiffres mt-0.5 text-lg font-bold">
                {fmt(selection.chiffreAffaires)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs text-[var(--encre-faible)]">Encours</p>
              <p
                className={`chiffres mt-0.5 text-lg font-bold ${
                  selection.encours > 0 ? "text-alerte-600" : ""
                }`}
              >
                {fmt(selection.encours)}
              </p>
            </div>
          </div>

          <div className="p-4">
            <h3 className="mb-2 text-xs font-semibold text-[var(--encre-faible)]">
              Derniers documents
            </h3>

            {documents.length === 0 ? (
              <p className="text-sm text-[var(--encre-faible)]">
                Aucun document pour ce client.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="chiffres block truncate text-xs">{doc.numero}</span>
                      <span className="block text-xs text-[var(--encre-faible)]">
                        {doc.date}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Pastille ton={TON_STATUT[doc.statut]}>
                        {LIBELLE_STATUT[doc.statut]}
                      </Pastille>
                      <span className="chiffres w-24 text-right font-semibold">
                        {fmt(totalTTC(doc))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex gap-2">
              <BoutonSecondaire>Devis</BoutonSecondaire>
              <BoutonPrincipal>Facture</BoutonPrincipal>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
