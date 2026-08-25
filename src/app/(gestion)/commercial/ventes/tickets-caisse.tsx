import Link from "next/link";

import { Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { fmt, fmtEntier } from "@/lib/format";
import type { JourneeCaisse, TicketResume } from "@/modules/ventes/requetes";
import type { SessionCaisse } from "@/modules/ventes/schema-session";
import type { MoyenReglementVente } from "@/modules/ventes/schema";
import { FormulairePoste } from "./formulaire-poste";

const LIBELLE_MOYEN: Record<MoyenReglementVente, string> = {
  especes: "Espèces",
  mobile_money: "Mobile money",
  carte: "Carte",
  banque: "Virement",
  credit: "À crédit",
};

const horodatage = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Encaissements de caisse, en face des pièces commerciales.
 *
 * Ce sont deux flux de vente, et il n'y en a qu'un en base pour l'instant : le
 * ticket. La facture et le devis restent des données de démonstration — les
 * mêler sans le dire ferait croire que tout est enregistré.
 */
export function TicketsCaisse({
  tickets,
  journee,
  postes,
  depots,
  clotures,
}: {
  tickets: TicketResume[];
  journee: JourneeCaisse;
  postes: { code: string; nom: string; depotNom: string; dernierNumero: number }[];
  depots: { id: string; nom: string }[];
  clotures: (SessionCaisse & { caisseCode: string })[];
}) {
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Encaissements de caisse</h2>
          <p className="text-xs text-[var(--encre-faible)]">
            {postes.length === 0
              ? "Aucun poste ouvert"
              : `${postes.length} poste${postes.length > 1 ? "s" : ""} · ${postes.map((p) => p.code).join(", ")}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FormulairePoste depots={depots} />
          <Link
            href="/caisse"
            className="text-sm font-medium text-marque-600 hover:underline"
          >
            Ouvrir la caisse
          </Link>
        </div>
      </div>

      {/* --------------------------------------------------- la journée */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Chiffre libelle="Tickets du jour" valeur={fmtEntier(journee.tickets)} />
        <Chiffre
          libelle="Chiffre d'affaires"
          valeur={fmt(journee.chiffreAffaires)}
          unite="FCFA"
        />
        <Chiffre libelle="Panier moyen" valeur={fmt(journee.panierMoyen)} unite="FCFA" />
        <Chiffre
          libelle="Marge brute"
          valeur={fmt(journee.margeBrute)}
          unite="FCFA"
          precision="Vente hors taxes moins coût de revient"
        />
      </div>

      {/* Le détail par moyen est ce qui rend le comptage possible : le tiroir
          se compare aux espèces, le relevé mobile money au reste. */}
      {journee.parMoyen.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {journee.parMoyen.map((part) => (
            <li
              key={part.moyen}
              className="rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3 py-1.5 text-xs"
            >
              <span className="text-[var(--encre-faible)]">
                {LIBELLE_MOYEN[part.moyen]}
              </span>{" "}
              <span className="chiffres font-semibold">{fmt(part.montant)}</span>
            </li>
          ))}
        </ul>
      )}

      {tickets.length === 0 ? (
        <p className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--encre-douce)]">
          {postes.length === 0
            ? "Ouvrez un poste de caisse pour encaisser."
            : "Aucun encaissement pour l'instant."}
        </p>
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Ticket</Th>
              <Th>Caisse</Th>
              <Th>Client</Th>
              <Th aligne="droite">Lignes</Th>
              <Th>Règlement</Th>
              <Th aligne="droite">Montant</Th>
              <Th aligne="droite">Encaissé le</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <Td fort>
                  <span className="chiffres">{ticket.numero}</span>
                  {ticket.statut === "annulee" && (
                    <span className="ml-2 align-middle">
                      <Pastille ton="danger">Annulé</Pastille>
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="chiffres text-xs text-[var(--encre-faible)]">
                    {ticket.caisseCode}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs text-[var(--encre-douce)]">
                    {ticket.clientNom ?? "Comptoir"}
                  </span>
                </Td>
                <Td aligne="droite" chiffres>
                  {ticket.lignes}
                </Td>
                <Td>
                  <span className="text-xs text-[var(--encre-douce)]">
                    {ticket.moyens.length === 0
                      ? "—"
                      : [...new Set(ticket.moyens)]
                          .map((moyen) => LIBELLE_MOYEN[moyen])
                          .join(" + ")}
                  </span>
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmt(ticket.totalTtc)}
                </Td>
                <Td aligne="droite">
                  <span className="chiffres text-xs text-[var(--encre-faible)]">
                    {horodatage.format(ticket.encaisseeLe)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      {/* Les écarts passés. Constater un manque et ne jamais le revoir revient
          à ne pas l'avoir constaté : c'est la répétition qui révèle un vol, pas
          l'incident isolé. */}
      {clotures.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Dernières clôtures</h3>
          <ul className="divide-y divide-[var(--filet)] overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
            {clotures.map((cloture) => (
              <li
                key={cloture.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
              >
                <span className="chiffres text-xs text-[var(--encre-faible)]">
                  {cloture.caisseCode}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {cloture.caissier}
                  {cloture.motifEcart && (
                    <span className="ml-2 text-xs text-[var(--encre-faible)]">
                      {cloture.motifEcart}
                    </span>
                  )}
                </span>
                <span className="chiffres text-xs text-[var(--encre-faible)]">
                  fond {fmt(cloture.fondInitial)}
                </span>
                {cloture.ecart === 0 ? (
                  <Pastille ton="valide">Juste</Pastille>
                ) : (
                  <Pastille ton={cloture.ecart < 0 ? "danger" : "alerte"}>
                    {cloture.ecart < 0 ? "Manque" : "Excédent"} {fmt(Math.abs(cloture.ecart))}
                  </Pastille>
                )}
                <span className="chiffres text-xs text-[var(--encre-faible)]">
                  {cloture.clotureeLe ? horodatage.format(cloture.clotureeLe) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Chiffre({
  libelle,
  valeur,
  unite,
  precision,
}: {
  libelle: string;
  valeur: string;
  unite?: string;
  precision?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-3.5">
      <p className="text-xs text-[var(--encre-faible)]">{libelle}</p>
      <p className="chiffres mt-1 text-lg font-bold">
        {valeur}
        {unite && (
          <span className="ml-1 text-xs font-medium text-[var(--encre-faible)]">
            {unite}
          </span>
        )}
      </p>
      {precision && (
        <p className="mt-0.5 text-xs text-[var(--encre-faible)]">{precision}</p>
      )}
    </div>
  );
}
