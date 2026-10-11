import type { Metadata } from "next";
import Link from "next/link";

import { FormulaireSejour } from "@/components/hotel/formulaires";
import { EnTetePage, EtatVide, Pastille, Tableau, Td, Th, type TonPastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtPeriode } from "@/lib/format";
import { aujourdHuiPour } from "@/modules/hotellerie/creation";
import { clientsHotel, listerSejours, tableauDesChambres } from "@/modules/hotellerie/requetes";
import { ajouterJours } from "@/modules/reservations/calcul";
import type { StatutContrat } from "@/modules/reservations/schema";

export const metadata: Metadata = { title: "Séjours" };

const STATUT: Record<StatutContrat, { libelle: string; ton: TonPastille }> = {
  reserve: { libelle: "Réservé", ton: "neutre" },
  en_cours: { libelle: "Présent", ton: "marque" },
  restitue: { libelle: "Parti", ton: "valide" },
  annule: { libelle: "Annulé", ton: "neutre" },
};

export default async function PageSejours() {
  const session = await exigerEntreprise();
  const jour = await aujourdHuiPour(session.organizationId);
  const [sejours, chambres, clients, reserver] = await Promise.all([
    listerSejours(session.organizationId),
    tableauDesChambres(session.organizationId, jour),
    clientsHotel(session.organizationId),
    peut("hotellerie.sejour.gerer"),
  ]);

  return (
    <>
      <EnTetePage
        titre="Séjours"
        sousTitre="Présents, réservations à venir et départs"
        actions={
          reserver ? (
            <FormulaireSejour
              chambres={chambres
                .filter((c) => c.statut === "active")
                .map((c) => ({ id: c.id, code: c.code, libelle: c.categorie ?? c.designation, capacite: c.capacite }))}
              clients={clients}
              aujourdHui={jour}
              demain={ajouterJours(jour, 1)}
            />
          ) : undefined
        }
      />

      {sejours.length === 0 ? (
        <EtatVide
          titre="Aucun séjour"
          message="Une réservation bloque la chambre de l'arrivée à la veille du départ. Le client arrive sans payer, sa note s'allonge pendant le séjour et se solde au départ."
        />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Séjour</Th>
              <Th>Chambre</Th>
              <Th>Client</Th>
              <Th>Dates</Th>
              <Th>Statut</Th>
              <Th aligne="droite">Note</Th>
              <Th aligne="droite">Reste dû</Th>
            </tr>
          </thead>
          <tbody>
            {sejours.map((s) => {
              const statut = s.statut === "reserve" && s.arrivee < jour ? { libelle: "Non arrivé", ton: "alerte" as TonPastille } : STATUT[s.statut];
              const reste = s.total - s.verse;
              return (
                <tr key={s.id}>
                  <Td chiffres fort>
                    <Link href={`/hotel/sejours/${s.id}`} className="hover:underline">
                      {s.numero}
                    </Link>
                  </Td>
                  <Td chiffres>{s.chambre}</Td>
                  <Td>
                    <span className="block min-w-32">{s.client}</span>
                    <span className="block text-xs text-[var(--encre-faible)]">
                      {s.personnes} pers.
                    </span>
                  </Td>
                  <Td chiffres>
                    {fmtPeriode(s.arrivee, s.depart)}
                    <span className="block text-xs text-[var(--encre-faible)]">
                      {s.nuits} nuit{s.nuits > 1 ? "s" : ""}
                    </span>
                  </Td>
                  <Td>
                    <Pastille ton={statut.ton}>{statut.libelle}</Pastille>
                  </Td>
                  <Td aligne="droite" chiffres>
                    {s.statut === "annule" ? "—" : fmt(s.total)}
                  </Td>
                  <Td aligne="droite" chiffres fort>
                    {s.statut === "en_cours" || s.statut === "reserve" ? fmt(reste) : "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tableau>
      )}
    </>
  );
}
