import type { Metadata } from "next";

import { BoutonDemonstration } from "@/components/bouton-demonstration";
import {
  CarteIndicateur,
  EnTetePage,
  EtatVide,
  Pastille,
  Tableau,
  Td,
  Th,
  type TonPastille,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import { calculerBulletin, joursAvantTerme } from "@/modules/personnes/paie";
import { listerSalaries } from "@/modules/personnes/requetes";
import type { TypeContrat } from "@/modules/personnes/schema";

import { FormulaireSalarie } from "./formulaire-salarie";

export const metadata: Metadata = { title: "Salariés" };

const LIBELLE_CONTRAT: Record<TypeContrat, string> = {
  cdi: "CDI",
  cdd: "CDD",
  stage: "Stage",
  essai: "Essai",
};

const TON_CONTRAT: Record<TypeContrat, TonPastille> = {
  cdi: "valide",
  cdd: "marque",
  stage: "neutre",
  essai: "alerte",
};

export default async function PageSalaries() {
  const session = await exigerEntreprise();
  const salaries = await listerSalaries(session.organizationId);

  const bulletins = salaries.map((salarie) =>
    calculerBulletin({
      id: salarie.id,
      matricule: salarie.matricule,
      nom: salarie.nom,
      salaireBase: salarie.salaireBase,
    }),
  );

  const masse = bulletins.reduce((somme, b) => somme + b.brut, 0);
  const cout = bulletins.reduce((somme, b) => somme + b.coutTotal, 0);

  // Un contrat à durée indéterminée n'a pas d'échéance : il ne compte ni dans
  // les contrats qui expirent, ni dans ceux qui seraient « hors délai ».
  // Le concurrent affiche « OK (>60j) : 0 » alors que huit CDI sont en cours.
  const aujourdhui = new Date();
  const echeances = salaries.map((salarie) => ({
    salarie,
    jours: joursAvantTerme(salarie.fin, aujourdhui),
  }));

  const bientot = echeances.filter(
    ({ jours }) => jours !== null && jours >= 0 && jours <= 60,
  );
  const expires = echeances.filter(({ jours }) => jours !== null && jours < 0);
  const sansCnps = salaries.filter((salarie) => !salarie.numeroCnps);

  const indetermines = salaries.filter((salarie) => salarie.contrat === "cdi");

  return (
    <>
      <EnTetePage
        titre="Salariés"
        sousTitre={
          salaries.length === 0
            ? "Aucun salarié inscrit"
            : `${salaries.length} salariés · ${indetermines.length} en contrat à durée indéterminée`
        }
        actions={<FormulaireSalarie premier={salaries.length === 0} />}
      />

      {salaries.length === 0 ? (
        <EtatVide
          titre="Aucun salarié"
          message="Un salarié porte un contrat, un numéro CNPS et un bulletin — à ne pas confondre avec l'intervenant payé à la journée, qui se tient dans l'onglet voisin. Vous pouvez aussi installer le jeu de démonstration."
          actions={<BoutonDemonstration libelle="Installer le jeu de démonstration" />}
        />
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CarteIndicateur
              libelle="Masse salariale brute"
              valeur={fmtCompact(masse)}
              unite="FCFA"
              precision="Par mois"
            />
            <CarteIndicateur
              libelle="Coût employeur"
              valeur={fmtCompact(cout)}
              unite="FCFA"
              precision="Brut et charges patronales"
            />
            <CarteIndicateur
              libelle="Contrats à échéance"
              valeur={fmtEntier(bientot.length)}
              ton={bientot.length > 0 ? "alerte" : "valide"}
              precision="Dans les 60 jours"
            />
            <CarteIndicateur
              libelle="Contrats expirés"
              valeur={fmtEntier(expires.length)}
              ton={expires.length > 0 ? "danger" : "valide"}
              precision="À renouveler ou clôturer"
            />
          </section>

          <Tableau>
            <thead>
              <tr>
                <Th>Matricule</Th>
                <Th>Salarié</Th>
                <Th>Poste</Th>
                <Th>Contrat</Th>
                <Th>Échéance</Th>
                <Th>N° CNPS</Th>
                <Th aligne="droite">Salaire de base</Th>
              </tr>
            </thead>
            <tbody>
              {echeances.map(({ salarie, jours }) => (
                <tr key={salarie.id}>
                  <Td chiffres>{salarie.matricule}</Td>
                  <Td fort>{salarie.nom}</Td>
                  <Td>
                    <span className="text-xs text-[var(--encre-douce)]">
                      {salarie.poste}
                    </span>
                  </Td>
                  <Td>
                    <Pastille ton={TON_CONTRAT[salarie.contrat]}>
                      {LIBELLE_CONTRAT[salarie.contrat]}
                    </Pastille>
                  </Td>
                  <Td>
                    {jours === null ? (
                      <span className="text-xs text-[var(--encre-faible)]">
                        Indéterminée
                      </span>
                    ) : jours < 0 ? (
                      <Pastille ton="danger">Expiré</Pastille>
                    ) : jours <= 60 ? (
                      <Pastille ton="alerte">Dans {jours} j</Pastille>
                    ) : (
                      <span className="chiffres text-xs">{salarie.fin}</span>
                    )}
                  </Td>
                  <Td chiffres>
                    {/* Sans numéro CNPS, aucune déclaration n'est possible :
                        l'absence est signalée, pas laissée vide. */}
                    {salarie.numeroCnps ?? <Pastille ton="alerte">Manquant</Pastille>}
                  </Td>
                  <Td aligne="droite" chiffres fort>
                    {fmt(salarie.salaireBase)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tableau>

          {sansCnps.length > 0 && (
            <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
              {sansCnps.length} salarié{sansCnps.length > 1 ? "s" : ""} sans numéro
              CNPS. La déclaration sociale les laissera de côté tant que le numéro
              manque, et le retard se règle auprès de la caisse, pas dans le
              logiciel.
            </p>
          )}
        </>
      )}
    </>
  );
}
