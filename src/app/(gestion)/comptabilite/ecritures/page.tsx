import type { Metadata } from "next";

import { EnTetePage, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmt, fmtDateIso } from "@/lib/format";
import { journalEcritures } from "@/modules/comptabilite/requetes";
import { SaisieEcriture } from "./saisie";

export const metadata: Metadata = { title: "Écritures" };

/** D'où vient l'écriture. Une saisie manuelle se distingue d'un ticket. */
const ORIGINES: Record<string, string> = {
  facture: "Facture",
  avoir: "Avoir",
  reglement: "Règlement",
  achat: "Achat",
  bon_caisse: "Bon de caisse",
  vente_pos: "Caisse",
  saisie: "Saisie",
  bon_paiement: "Bon de paiement",
  virement: "Virement",
  avance: "Avance",
  arrete_caisse: "Arrêté de caisse",
  releve: "Relevé bancaire",
  paie: "Paie",
  tva: "TVA",
  cloture: "Clôture",
};

export default async function PageEcritures() {
  const session = await exigerEntreprise();
  const ecritures = await journalEcritures(session.organizationId, { limite: 30 });

  return (
    <>
      <EnTetePage
        titre="Écritures"
        sousTitre="Saisie guidée, partie double automatique"
      />

      <SaisieEcriture />

      <section className="mt-6">
        <h2 className="mb-2.5 text-base font-semibold">Journal</h2>

        {ecritures.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--filet)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--encre-douce)]">
            Aucune écriture pour l&apos;instant. Elles arriveront d&apos;elles-mêmes
            dès la première vente encaissée, ou par la saisie ci-dessus.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-[var(--encre-douce)]">
              {ecritures.length === 1
                ? "La seule écriture de l'exercice."
                : `Les ${ecritures.length} dernières écritures, de la plus récente à la plus ancienne.`}{" "}
              Chacune porte la pièce qui l&apos;a produite : un solde qu&apos;on
              ne sait pas rattacher à un document est un solde qu&apos;on ne sait
              pas justifier devant un contrôle.
            </p>

            <Tableau>
              <thead>
                <tr>
                  <Th>Écriture</Th>
                  <Th>Date</Th>
                  <Th>Libellé</Th>
                  <Th>Comptes</Th>
                  <Th aligne="droite">Montant</Th>
                </tr>
              </thead>
              <tbody>
                {ecritures.map((ecriture) => {
                  const montant = ecriture.lignes.reduce((s, l) => s + l.debit, 0);

                  return (
                    <tr key={ecriture.id}>
                      <Td>
                        <span className="chiffres block font-semibold">
                          {ecriture.numero}
                        </span>
                        <span className="block text-xs text-[var(--encre-faible)]">
                          {ORIGINES[ecriture.origine] ?? ecriture.origine} ·{" "}
                          {ecriture.pieceNumero}
                        </span>
                      </Td>
                      <Td chiffres>{fmtDateIso(ecriture.date)}</Td>
                      <Td>
                        {ecriture.libelle}
                        {ecriture.statut !== "validee" && (
                          <span className="ml-2 inline-block align-middle">
                            <Pastille
                              ton={ecriture.statut === "brouillon" ? "alerte" : "neutre"}
                            >
                              {ecriture.statut === "brouillon" ? "Brouillon" : "Verrouillée"}
                            </Pastille>
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="chiffres text-xs text-[var(--encre-douce)]">
                          {ecriture.lignes
                            .map((ligne) => ligne.compte)
                            .join(" · ")}
                        </span>
                      </Td>
                      <Td aligne="droite" chiffres fort>
                        {fmt(montant)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tableau>
          </>
        )}
      </section>
    </>
  );
}
