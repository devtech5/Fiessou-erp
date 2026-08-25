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
import { BULLETINS, EMPLOYES, type TypeContrat } from "@/lib/fixtures/rh";

export const metadata: Metadata = { title: "Salariés" };

const TON_CONTRAT: Record<TypeContrat, TonPastille> = {
  CDI: "valide",
  CDD: "marque",
  Stage: "neutre",
  Essai: "alerte",
};

/** Jours restants avant la fin d'un contrat à durée déterminée. */
function joursAvantFin(fin?: string): number | null {
  if (!fin) return null;
  const [jour, mois, annee] = fin.split("/").map(Number);
  const echeance = new Date(annee, mois - 1, jour);
  const aujourdhui = new Date(2026, 7, 25);
  return Math.round((echeance.getTime() - aujourdhui.getTime()) / 86_400_000);
}

export default function PageSalaries() {
  const masse = BULLETINS.reduce((somme, b) => somme + b.brut, 0);
  const cout = BULLETINS.reduce((somme, b) => somme + b.coutTotal, 0);

  // Un contrat à durée indéterminée n'a pas d'échéance : il ne compte ni dans
  // les contrats qui expirent, ni dans ceux qui seraient « hors délai ».
  // Le concurrent affiche « OK (>60j) : 0 » alors que huit CDI sont en cours.
  const aEcheance = EMPLOYES.filter((e) => e.fin);
  const bientot = aEcheance.filter((e) => {
    const jours = joursAvantFin(e.fin);
    return jours !== null && jours >= 0 && jours <= 60;
  });
  const expires = aEcheance.filter((e) => {
    const jours = joursAvantFin(e.fin);
    return jours !== null && jours < 0;
  });

  return (
    <>
      <EnTetePage
        titre="Salariés"
        sousTitre={`${EMPLOYES.length} salariés · ${EMPLOYES.filter((e) => !e.fin).length} en contrat à durée indéterminée`}
        actions={<BoutonPrincipal>Nouveau salarié</BoutonPrincipal>}
      />

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
          {EMPLOYES.map((employe) => {
            const jours = joursAvantFin(employe.fin);
            return (
              <tr key={employe.id}>
                <Td chiffres>{employe.matricule}</Td>
                <Td fort>{employe.nom}</Td>
                <Td>
                  <span className="text-xs text-[var(--encre-douce)]">
                    {employe.poste}
                  </span>
                </Td>
                <Td>
                  <Pastille ton={TON_CONTRAT[employe.contrat]}>
                    {employe.contrat}
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
                    <span className="chiffres text-xs">{employe.fin}</span>
                  )}
                </Td>
                <Td chiffres>
                  {/* Sans numéro CNPS, aucune déclaration n'est possible :
                      l'absence est signalée, pas laissée vide. */}
                  {employe.numeroCnps ?? (
                    <Pastille ton="alerte">Manquant</Pastille>
                  )}
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmt(employe.salaireBase)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Tableau>
    </>
  );
}
