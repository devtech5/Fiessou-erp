import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { FormulaireDesinscription } from "@/components/communication/formulaire-desinscription";
import { EnTetePage, EtatVide, Tableau, Td, Th } from "@/components/ui/primitives";
import { db } from "@/db";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { CANAUX } from "@/modules/communication/calcul";
import { desinscriptions } from "@/modules/communication/schema";

export const metadata: Metadata = { title: "Désinscriptions" };

const JOUR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Abidjan" });

/**
 * Qui ne veut plus rien recevoir. Le lien en pied de chaque e-mail inscrit le
 * destinataire ici sans compte ; une demande faite au téléphone se saisit à la
 * main. Aucun envoi — facture, relance, message groupé — ne passe outre.
 */
export default async function PageDesinscriptions() {
  const session = await exigerEntreprise();
  const [liste, gerer] = await Promise.all([
    db.select().from(desinscriptions).where(eq(desinscriptions.organizationId, session.organizationId)).orderBy(desc(desinscriptions.createdAt)),
    peut("communication.client.notifier"),
  ]);

  return (
    <>
      <EnTetePage titre="Désinscriptions" sousTitre="Destinataires qui ont demandé à ne plus recevoir de messages" actions={gerer ? <FormulaireDesinscription /> : undefined} />
      {liste.length === 0 ? (
        <EtatVide titre="Aucune désinscription" message="Chaque e-mail porte un lien « Ne plus recevoir nos messages ». La loi ivoirienne sur les données personnelles impose de respecter ce choix." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Canal</Th>
              <Th>Adresse</Th>
              <Th>Origine</Th>
            </tr>
          </thead>
          <tbody>
            {liste.map((d) => (
              <tr key={d.id}>
                <Td chiffres>{JOUR.format(d.createdAt)}</Td>
                <Td>{CANAUX[d.canal]}</Td>
                <Td chiffres>{d.adresse}</Td>
                <Td>{d.origine === "lien" ? "Lien du message" : "Demande saisie"}</Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  );
}
