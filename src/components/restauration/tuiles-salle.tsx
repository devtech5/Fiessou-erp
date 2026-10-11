"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Retour, type Resultat } from "@/components/ui/operations";
import { CLASSE_CHAMP, Champ, Pastille } from "@/components/ui/primitives";
import { fmt } from "@/lib/format";
import { ouvrirCommande } from "@/modules/restauration/actions";
import { ESPACES, libelleDuree, type EtatTable, type Espace } from "@/modules/restauration/calcul";

export interface TableTuile {
  id: string;
  nom: string;
  zone: string | null;
  places: number | null;
}

export interface CommandeTuile {
  id: string;
  numero: string;
  tableId: string | null;
  libelle: string | null;
  couverts: number | null;
  serveur: string | null;
  minutes: number;
  total: number;
  enPreparation: number;
  pretes: number;
  etat: EtatTable;
}

const HABILLAGE: Record<EtatTable, string> = {
  libre: "border-[var(--filet)] bg-[var(--surface)] hover:border-marque-400",
  occupee: "border-marque-400 bg-marque-50/40 hover:border-marque-600",
  a_servir: "border-alerte-600 bg-alerte-50 hover:border-alerte-600",
};

/** Ouverture d'une table ou d'une commande à emporter, en petit dialogue. */
type Ouverture = { tableId: string; nom: string } | { tableId: null };

export function TuilesSalle({
  espace,
  tables,
  commandes,
  peutPrendre,
  couverts,
}: {
  espace: Espace;
  tables: TableTuile[];
  commandes: CommandeTuile[];
  peutPrendre: boolean;
  couverts: boolean;
}) {
  const racine = ESPACES[espace].racine;
  const parTable = new Map(commandes.filter((c) => c.tableId).map((c) => [c.tableId as string, c]));
  const aEmporter = commandes.filter((c) => c.tableId === null);
  const [ouverture, setOuverture] = useState<Ouverture | null>(null);

  // Les tables se rangent par zone, dans l'ordre où le gérant les a posées.
  const zones = new Map<string, TableTuile[]>();
  for (const table of tables) {
    const zone = table.zone ?? "Salle";
    zones.set(zone, [...(zones.get(zone) ?? []), table]);
  }

  return (
    <>
      {[...zones.entries()].map(([zone, liste]) => (
        <section key={zone} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--encre-faible)]">{zone}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
            {liste.map((table) => {
              const commande = parTable.get(table.id);
              const contenu = <Tuile nom={table.nom} places={table.places} commande={commande ?? null} />;
              if (commande) {
                return (
                  <Link
                    key={table.id}
                    href={`${racine}/commandes/${commande.id}`}
                    className={`block rounded-xl border-2 p-3 ${HABILLAGE[commande.etat]}`}
                  >
                    {contenu}
                  </Link>
                );
              }
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={!peutPrendre}
                  onClick={() => setOuverture({ tableId: table.id, nom: table.nom })}
                  className={`block rounded-xl border-2 p-3 text-left disabled:cursor-default ${HABILLAGE.libre}`}
                >
                  {contenu}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--encre-faible)]">À emporter</h2>
          {peutPrendre && (
            <button
              type="button"
              onClick={() => setOuverture({ tableId: null })}
              className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]"
            >
              Nouvelle commande à emporter
            </button>
          )}
        </div>
        {aEmporter.length === 0 ? (
          <p className="text-sm text-[var(--encre-faible)]">Aucune commande à emporter en cours.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
            {aEmporter.map((commande) => (
              <Link
                key={commande.id}
                href={`${racine}/commandes/${commande.id}`}
                className={`block rounded-xl border-2 p-3 ${HABILLAGE[commande.etat]}`}
              >
                <Tuile nom={commande.libelle ?? commande.numero} places={null} commande={commande} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {ouverture && (
        <DialogueOuverture
          espace={espace}
          ouverture={ouverture}
          couverts={couverts}
          onFermer={() => setOuverture(null)}
        />
      )}
    </>
  );
}

function Tuile({ nom, places, commande }: { nom: string; places: number | null; commande: CommandeTuile | null }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-base font-bold">{nom}</p>
        {commande?.etat === "a_servir" ? (
          <Pastille ton="alerte">À servir</Pastille>
        ) : commande ? (
          <Pastille ton="marque">Occupée</Pastille>
        ) : (
          <Pastille>Libre</Pastille>
        )}
      </div>
      {commande ? (
        <>
          <p className="chiffres mt-2 text-lg font-semibold">{fmt(commande.total)} F</p>
          <p className="mt-0.5 truncate text-xs text-[var(--encre-faible)]">
            {libelleDuree(commande.minutes)}
            {commande.couverts ? ` · ${commande.couverts} couv.` : ""}
            {commande.serveur ? ` · ${commande.serveur}` : ""}
          </p>
          {(commande.enPreparation > 0 || commande.pretes > 0) && (
            <p className="mt-0.5 text-xs text-[var(--encre-douce)]">
              {commande.enPreparation > 0 && `${commande.enPreparation} en préparation`}
              {commande.enPreparation > 0 && commande.pretes > 0 && " · "}
              {commande.pretes > 0 && <strong className="text-alerte-600">{commande.pretes} prête{commande.pretes > 1 ? "s" : ""}</strong>}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-[var(--encre-faible)]">{places ? `${places} places` : " "}</p>
      )}
    </>
  );
}

function DialogueOuverture({
  espace,
  ouverture,
  couverts,
  onFermer,
}: {
  espace: Espace;
  ouverture: Ouverture;
  couverts: boolean;
  onFermer: () => void;
}) {
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [enCours, demarrer] = useTransition();
  const routeur = useRouter();
  const surTable = ouverture.tableId !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onFermer}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const donnees = new FormData(e.currentTarget);
          const nbCouverts = Number(donnees.get("couverts") || 0);
          demarrer(async () => {
            const r = await ouvrirCommande(espace, {
              tableId: ouverture.tableId,
              libelle: surTable ? null : String(donnees.get("libelle") ?? ""),
              couverts: Number.isInteger(nbCouverts) && nbCouverts > 0 ? nbCouverts : null,
            });
            setResultat(r);
            if (r.ok && r.id) routeur.push(`${ESPACES[espace].racine}/commandes/${r.id}`);
          });
        }}
        className="w-full max-w-sm rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
      >
        <h2 className="mb-4 text-base font-semibold">
          {"nom" in ouverture ? `Ouvrir la table ${ouverture.nom}` : "Commande à emporter"}
        </h2>
        <div className="space-y-3">
          {!surTable && (
            <Champ libelle="Nom du client ou repère">
              <input name="libelle" required autoFocus placeholder="Awa, moto rouge" className={CLASSE_CHAMP} />
            </Champ>
          )}
          {couverts && surTable && (
            <Champ libelle="Couverts" precision="Facultatif">
              <input name="couverts" inputMode="numeric" autoFocus placeholder="2" className={`${CLASSE_CHAMP} chiffres`} />
            </Champ>
          )}
        </div>
        <Retour resultat={resultat && !resultat.ok ? resultat : null} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onFermer} className="h-cible rounded-lg px-3.5 text-sm text-[var(--encre-douce)] hover:underline">
            Annuler
          </button>
          <button
            type="submit"
            disabled={enCours}
            className="h-cible rounded-lg bg-marque-600 px-4 text-sm font-semibold text-white hover:bg-marque-700 disabled:opacity-50"
          >
            {enCours ? "Ouverture…" : "Ouvrir"}
          </button>
        </div>
      </form>
    </div>
  );
}
