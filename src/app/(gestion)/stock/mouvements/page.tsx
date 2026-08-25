import type { Metadata } from "next";

import {
  CarteIndicateur,
  EnTetePage,
  Pastille,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmtEntier } from "@/lib/format";
import { MOUVEMENTS, type TypeMouvement } from "@/lib/fixtures/gestion";

export const metadata: Metadata = { title: "Mouvements de stock" };

const LIBELLE: Record<TypeMouvement, string> = {
  reception: "Réception",
  vente: "Vente",
  transfert: "Transfert",
  ajustement: "Ajustement",
  retour: "Retour",
};

const TON: Record<TypeMouvement, TonPastille> = {
  reception: "valide",
  vente: "neutre",
  transfert: "marque",
  ajustement: "alerte",
  retour: "neutre",
};

/**
 * Journal des mouvements.
 *
 * Chaque ligne porte sa pièce source — commande, ticket, bon de transfert,
 * inventaire, avoir. C'est ce qui rend un écart de stock explicable : sans
 * pièce, un inventaire faux ne se remonte jamais jusqu'à sa cause.
 *
 * Un transfert apparaît deux fois, en sortie du dépôt d'origine et en entrée
 * du dépôt de destination. Le concurrent n'en enregistre qu'un seul, en
 * positif, ce qui crée des unités qui n'existent pas.
 */
export default function PageMouvements() {
  const entrees = MOUVEMENTS.filter((m) => m.quantite > 0).length;
  const sorties = MOUVEMENTS.filter((m) => m.quantite < 0).length;

  return (
    <>
      <EnTetePage titre="Mouvements" sousTitre="Journal des entrées et sorties" />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <CarteIndicateur libelle="Mouvements" valeur={fmtEntier(MOUVEMENTS.length)} precision="Sur la période affichée" />
        <CarteIndicateur libelle="Entrées" valeur={fmtEntier(entrees)} ton="valide" />
        <CarteIndicateur libelle="Sorties" valeur={fmtEntier(sorties)} ton="alerte" />
      </section>

      <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
        {MOUVEMENTS.map((mouvement) => (
          <li key={mouvement.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
            <Pastille ton={TON[mouvement.type]}>{LIBELLE[mouvement.type]}</Pastille>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{mouvement.article}</p>
              <p className="truncate text-xs text-[var(--encre-faible)]">
                <span className="chiffres">{mouvement.piece}</span>
                {" · "}
                {mouvement.depotVers
                  ? `${mouvement.depot} → ${mouvement.depotVers}`
                  : mouvement.depot}
                {mouvement.motif && ` · ${mouvement.motif}`}
              </p>
            </div>

            <div className="text-right">
              <p
                className={`chiffres text-sm font-bold ${
                  mouvement.quantite > 0 ? "text-valide-600" : "text-danger-600"
                }`}
              >
                {mouvement.quantite > 0 ? "+" : ""}
                {fmtEntier(mouvement.quantite)}
              </p>
              <p className="text-xs text-[var(--encre-faible)]">
                {mouvement.horodatage} · {mouvement.auteur}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
