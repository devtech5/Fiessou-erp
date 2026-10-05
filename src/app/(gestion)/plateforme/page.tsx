import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CarteIndicateur, EnTetePage, Pastille, Tableau, Td, Th, type TonPastille } from "@/components/ui/primitives";
import { FORMULES, formule, type Phase } from "@/lib/abonnement/calcul";
import { estAdminPlateforme } from "@/lib/abonnement/garde";
import { toutesLesEntreprises } from "@/lib/abonnement/requetes";
import { exigerSession } from "@/lib/auth/dal";
import { fmt, fmtCompact } from "@/lib/format";

import { ActionsEntreprise } from "./actions-entreprise";

export const metadata: Metadata = { title: "Plateforme" };

const date = (v: string | Date | null) => (v ? (v instanceof Date ? v.toISOString() : v).slice(0, 10).split("-").reverse().join("/") : "—");

const PHASE: Record<Phase, { libelle: string; ton: TonPastille }> = {
  essai: { libelle: "Essai", ton: "marque" },
  actif: { libelle: "Actif", ton: "valide" },
  grace: { libelle: "Grâce", ton: "alerte" },
  expire: { libelle: "Lecture seule", ton: "danger" },
  suspendu: { libelle: "Suspendu", ton: "danger" },
  resilie: { libelle: "Résilié", ton: "neutre" },
};

/**
 * Console de la plateforme : toutes les entreprises, leur abonnement, les
 * paiements reçus. Réservée aux adresses de ADMINS_PLATEFORME ; pour tout
 * autre compte, la page n'existe pas.
 */
export default async function PagePlateforme() {
  const session = await exigerSession();
  if (!estAdminPlateforme(session.email)) notFound();

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const entreprises = await toutesLesEntreprises(aujourdhui);
  const compte = (p: Phase[]) => entreprises.filter((e) => p.includes(e.etat.phase)).length;

  return (
    <>
      <EnTetePage titre="Plateforme" sousTitre={`${entreprises.length} entreprise${entreprises.length > 1 ? "s" : ""} · abonnements et paiements`} />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur libelle="Abonnées" valeur={String(compte(["actif"]))} ton="valide" />
        <CarteIndicateur libelle="En essai" valeur={String(compte(["essai"]))} ton="marque" />
        <CarteIndicateur libelle="À relancer" valeur={String(compte(["grace", "expire"]))} ton={compte(["grace", "expire"]) > 0 ? "alerte" : "neutre"} precision="Échues, en grâce ou en lecture seule" />
        <CarteIndicateur libelle="Encaissé" valeur={fmtCompact(entreprises.reduce((s, e) => s + e.encaisse, 0))} unite="FCFA" precision="Depuis l'ouverture" />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Entreprise</Th>
            <Th>État</Th>
            <Th>Échéance</Th>
            <Th>Formule</Th>
            <Th aligne="droite">Membres</Th>
            <Th>Dernière activité</Th>
            <Th aligne="droite">Encaissé</Th>
            <Th aligne="droite">Gestes</Th>
          </tr>
        </thead>
        <tbody>
          {entreprises.map((e) => (
            <tr key={e.id}>
              <Td fort>
                {e.nom}
                <span className="block text-[11px] font-normal text-[var(--encre-faible)]">
                  {e.pays} · créée le {date(e.creeeLe)}
                </span>
              </Td>
              <Td>
                <Pastille ton={PHASE[e.etat.phase].ton}>{PHASE[e.etat.phase].libelle}</Pastille>
              </Td>
              <Td chiffres>{date(e.etat.finLe)}</Td>
              <Td>{formule(e.plan)?.nom ?? "—"}</Td>
              <Td aligne="droite" chiffres>
                {e.membres}
              </Td>
              <Td chiffres>{date(e.derniereActivite)}</Td>
              <Td aligne="droite" chiffres>
                {fmt(e.encaisse)}
              </Td>
              <Td aligne="droite">
                <ActionsEntreprise
                  id={e.id}
                  nom={e.nom}
                  statut={e.statut}
                  plan={e.plan ?? FORMULES[0].cle}
                  formules={FORMULES.map((f) => ({ cle: f.cle, nom: f.nom, prixMensuel: f.prixMensuel }))}
                  aujourdhui={aujourdhui}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </>
  );
}
