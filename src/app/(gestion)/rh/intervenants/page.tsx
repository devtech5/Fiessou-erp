import type { Metadata } from "next";

import {
  BoutonPrincipal,
  BoutonSecondaire,
  CarteIndicateur,
  EnTetePage,
  Pastille,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import {
  INTERVENANTS,
  LIBELLE_MODE,
  duIntervenant,
} from "@/lib/fixtures/rh";

export const metadata: Metadata = { title: "Intervenants" };

/**
 * Main-d'œuvre non salariée.
 *
 * Un maçon sur un chantier n'ouvre jamais le logiciel, n'a pas de contrat à
 * durée indéterminée, pas de numéro CNPS et pas de bulletin de paie. Il est
 * payé à la journée, à la tâche ou au mètre carré. Le module de paie classique
 * ne sait pas le représenter — c'est pour cela qu'aucun ERP concurrent n'est
 * utilisable sur un chantier ivoirien.
 *
 * Le même écran sert bien au-delà du bâtiment : chauffeurs occasionnels en
 * livraison, serveurs extra au maquis, coiffeuses à la commission, ouvriers
 * saisonniers, mécaniciens à la tâche.
 */
export default function PageIntervenants() {
  const parChantier = new Map<string, typeof INTERVENANTS>();
  for (const intervenant of INTERVENANTS) {
    const liste = parChantier.get(intervenant.chantier) ?? [];
    liste.push(intervenant);
    parChantier.set(intervenant.chantier, liste);
  }

  const totalDu = INTERVENANTS.reduce((somme, i) => somme + duIntervenant(i), 0);
  const totalEngage = INTERVENANTS.reduce(
    (somme, i) => somme + i.pointe * i.taux,
    0,
  );

  return (
    <>
      <EnTetePage
        titre="Intervenants"
        sousTitre="Main-d'œuvre payée à la journée, à la tâche ou à l'unité d'œuvre"
        actions={
          <>
            <BoutonSecondaire>Pointer</BoutonSecondaire>
            <BoutonPrincipal>Nouvel intervenant</BoutonPrincipal>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <CarteIndicateur
          libelle="Intervenants actifs"
          valeur={fmtEntier(INTERVENANTS.length)}
          precision={`Sur ${parChantier.size} chantiers`}
        />
        <CarteIndicateur
          libelle="Main-d'œuvre engagée"
          valeur={fmtCompact(totalEngage)}
          unite="FCFA"
          precision="Quantités pointées × taux"
        />
        <CarteIndicateur
          libelle="Reste à régler"
          valeur={fmtCompact(totalDu)}
          unite="FCFA"
          ton={totalDu > 0 ? "alerte" : "valide"}
          precision="Acomptes déduits"
        />
      </section>

      <div className="space-y-5">
        {[...parChantier.entries()].map(([chantier, equipe]) => {
          const engage = equipe.reduce((s, i) => s + i.pointe * i.taux, 0);
          const du = equipe.reduce((s, i) => s + duIntervenant(i), 0);

          return (
            <section
              key={chantier}
              className="overflow-hidden rounded-xl border border-[var(--filet)] bg-[var(--surface)]"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--filet)] bg-[var(--surface-creuse)] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">{chantier}</h2>
                  <p className="text-xs text-[var(--encre-faible)]">
                    {equipe.length} intervenant{equipe.length > 1 ? "s" : ""} ·{" "}
                    {fmt(engage)} FCFA engagés
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-[var(--encre-faible)]">Reste à régler</p>
                    <p className="chiffres text-base font-bold text-alerte-600">
                      {fmt(du)}
                    </p>
                  </div>
                  <BoutonPrincipal>Bon de paiement</BoutonPrincipal>
                </div>
              </header>

              <Tableau>
                <thead>
                  <tr>
                    <Th>Intervenant</Th>
                    <Th>Qualification</Th>
                    <Th>Rémunération</Th>
                    <Th aligne="droite">Taux</Th>
                    <Th aligne="droite">Pointé</Th>
                    <Th aligne="droite">Engagé</Th>
                    <Th aligne="droite">Reste dû</Th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.map((intervenant) => {
                    const engageLigne = intervenant.pointe * intervenant.taux;
                    const reste = duIntervenant(intervenant);

                    return (
                      <tr key={intervenant.id}>
                        <Td fort>
                          {intervenant.nom}
                          <span className="chiffres block text-xs font-normal text-[var(--encre-faible)]">
                            {intervenant.telephone}
                          </span>
                        </Td>
                        <Td>
                          <Pastille>{intervenant.qualification}</Pastille>
                        </Td>
                        <Td>
                          <span className="text-xs text-[var(--encre-douce)]">
                            {LIBELLE_MODE[intervenant.mode]}
                          </span>
                        </Td>
                        <Td aligne="droite" chiffres>
                          {fmt(intervenant.taux)}
                          <span className="block text-xs text-[var(--encre-faible)]">
                            / {intervenant.uniteLibelle}
                          </span>
                        </Td>
                        <Td aligne="droite" chiffres>
                          {fmtEntier(intervenant.pointe)}
                        </Td>
                        <Td aligne="droite" chiffres>
                          {fmt(engageLigne)}
                        </Td>
                        <Td aligne="droite" chiffres fort>
                          <span className={reste > 0 ? "text-alerte-600" : ""}>
                            {fmt(reste)}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tableau>
            </section>
          );
        })}
      </div>

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Un intervenant ne reçoit pas de bulletin de paie mais un bon de paiement.
        Sa rémunération ne se ventile pas comme un salaire : elle relève du
        personnel extérieur ou de la sous-traitance selon son statut réel. Un
        intervenant régularisé en contrat de travail conserve son historique.
      </p>
    </>
  );
}
