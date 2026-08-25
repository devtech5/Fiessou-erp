import type { Metadata } from "next";

import {
  BoutonPrincipal,
  CarteIndicateur,
  EnTetePage,
  Pastille,
  Tableau,
  Td,
  Th,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import {
  CONTRATS,
  LIBELLE_CONTRAT,
  LIBELLE_RESTITUTION,
  type StatutContrat,
} from "@/lib/fixtures/reservations";

export const metadata: Metadata = { title: "Contrats de location" };

const TON: Record<StatutContrat, TonPastille> = {
  reserve: "neutre",
  en_cours: "marque",
  restitue: "valide",
  en_retard: "danger",
  annule: "neutre",
};

export default function PageContrats() {
  const enCours = CONTRATS.filter((c) => c.statut === "en_cours");
  const retard = CONTRATS.filter((c) => c.statut === "en_retard");
  const revenus = CONTRATS.filter((c) => c.statut !== "annule").reduce(
    (s, c) => s + c.montant,
    0,
  );
  // Les cautions ne sont pas un produit : elles sont détenues et restituées.
  const cautionsDetenues = CONTRATS.filter(
    (c) => c.statut === "en_cours" || c.statut === "en_retard",
  ).reduce((s, c) => s + c.caution, 0);

  return (
    <>
      <EnTetePage
        titre="Contrats"
        sousTitre="Locations, séjours et mises à disposition"
        actions={<BoutonPrincipal>Nouveau contrat</BoutonPrincipal>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="En cours"
          valeur={fmtEntier(enCours.length)}
          precision={`Sur ${CONTRATS.length} contrats`}
        />
        <CarteIndicateur
          libelle="En retard"
          valeur={fmtEntier(retard.length)}
          ton={retard.length > 0 ? "danger" : "valide"}
          precision="Matériel non restitué"
        />
        <CarteIndicateur
          libelle="Produit des locations"
          valeur={fmtCompact(revenus)}
          unite="FCFA"
          ton="valide"
        />
        <CarteIndicateur
          libelle="Cautions détenues"
          valeur={fmtCompact(cautionsDetenues)}
          unite="FCFA"
          precision="À restituer, pas un revenu"
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Numéro</Th>
            <Th>Ressource</Th>
            <Th>Client</Th>
            <Th>Période</Th>
            <Th aligne="droite">Qté</Th>
            <Th>Statut</Th>
            <Th aligne="droite">Montant</Th>
            <Th aligne="droite">Caution</Th>
          </tr>
        </thead>
        <tbody>
          {CONTRATS.map((contrat) => (
            <tr key={contrat.id}>
              <Td chiffres fort>
                {contrat.numero}
              </Td>
              <Td>
                {contrat.ressource}
                <span className="chiffres block text-xs text-[var(--encre-faible)]">
                  {contrat.codeRessource}
                </span>
              </Td>
              <Td>{contrat.client}</Td>
              <Td chiffres>
                {contrat.debut} → {contrat.fin}
                <span className="block text-xs text-[var(--encre-faible)]">
                  {contrat.jours} jour{contrat.jours > 1 ? "s" : ""}
                </span>
              </Td>
              <Td aligne="droite" chiffres>
                {contrat.quantite}
              </Td>
              <Td>
                <Pastille ton={TON[contrat.statut]}>
                  {LIBELLE_CONTRAT[contrat.statut]}
                </Pastille>
                {contrat.etatRestitution && (
                  <span className="mt-1 block">
                    <Pastille
                      ton={contrat.etatRestitution === "bon" ? "valide" : "alerte"}
                    >
                      {LIBELLE_RESTITUTION[contrat.etatRestitution]}
                    </Pastille>
                  </span>
                )}
              </Td>
              <Td aligne="droite" chiffres fort>
                {fmt(contrat.montant)}
              </Td>
              <Td aligne="droite" chiffres>
                {fmt(contrat.caution)}
                {/* Une retenue sur caution doit rester lisible : c'est la
                    source de litige la plus fréquente en location. */}
                {contrat.retenue && (
                  <span className="block text-xs font-semibold text-danger-600">
                    − {fmt(contrat.retenue)} retenus
                  </span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        La caution est détenue, pas encaissée : elle ne figure ni dans le produit
        des locations ni dans le chiffre d&apos;affaires. Seule une retenue pour
        dégât, perte ou retard devient une recette.
      </p>
    </>
  );
}
