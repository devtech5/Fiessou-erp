import type { Metadata } from "next";

import {
  BoutonPrincipal,
  BoutonSecondaire,
  CarteIndicateur,
  EnTetePage,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { fmt, fmtCompact, fmtRetenue, fmtTaux } from "@/lib/format";
import { BAREME_CI, BULLETINS } from "@/lib/fixtures/rh";

export const metadata: Metadata = { title: "Paie" };

/**
 * Bulletins du mois.
 *
 * La colonne qui compte est le net à payer, et il est toujours inférieur au
 * brut. Cela paraît évident ; la capture marketing du concurrent affiche
 * pourtant un net supérieur au brut sur chacune de ses lignes — 120 000 de
 * brut, 13 420 de retenues, 132 000 de net. Le total et le détail y sont
 * remplis par deux calculs différents.
 */
export default function PagePaie() {
  const brut = BULLETINS.reduce((s, b) => s + b.brut, 0);
  const retenues = BULLETINS.reduce((s, b) => s + b.cotisationsSalariales + b.impot, 0);
  const net = BULLETINS.reduce((s, b) => s + b.net, 0);
  const patronales = BULLETINS.reduce((s, b) => s + b.chargesPatronales, 0);

  return (
    <>
      <EnTetePage
        titre="Paie"
        sousTitre="Août 2026 · bulletins en préparation"
        actions={
          <>
            <BoutonSecondaire>Livre de paie</BoutonSecondaire>
            <BoutonPrincipal>Générer les bulletins</BoutonPrincipal>
          </>
        }
      />

      {BAREME_CI.aVerifier && (
        <p className="mb-5 rounded-xl border-l-4 border-alerte-500 bg-alerte-50 px-4 py-3 text-sm text-alerte-600">
          <strong className="font-semibold">Barèmes de démonstration.</strong> Les
          taux CNPS et le barème ITS employés ici doivent être vérifiés auprès des
          administrations et confrontés à des bulletins réels avant toute mise en
          production.
        </p>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur libelle="Masse brute" valeur={fmtCompact(brut)} unite="FCFA" />
        <CarteIndicateur
          libelle="Retenues salariales"
          valeur={fmtCompact(retenues)}
          unite="FCFA"
          precision="CNPS et ITS"
        />
        <CarteIndicateur
          libelle="Net à payer"
          valeur={fmtCompact(net)}
          unite="FCFA"
          ton="valide"
          precision="Brut moins retenues"
        />
        <CarteIndicateur
          libelle="Charges patronales"
          valeur={fmtCompact(patronales)}
          unite="FCFA"
          precision="À la charge de l'employeur"
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Matricule</Th>
            <Th>Salarié</Th>
            <Th aligne="droite">Brut</Th>
            <Th aligne="droite">CNPS</Th>
            <Th aligne="droite">ITS</Th>
            <Th aligne="droite">Net à payer</Th>
            <Th aligne="droite">Coût employeur</Th>
          </tr>
        </thead>
        <tbody>
          {BULLETINS.map((bulletin) => (
            <tr key={bulletin.employe.id}>
              <Td chiffres>{bulletin.employe.matricule}</Td>
              <Td fort>{bulletin.employe.nom}</Td>
              <Td aligne="droite" chiffres>
                {fmt(bulletin.brut)}
              </Td>
              <Td aligne="droite" chiffres>
                <span className="text-danger-600">
                  {fmtRetenue(bulletin.cotisationsSalariales)}
                </span>
              </Td>
              <Td aligne="droite" chiffres>
                <span className="text-danger-600">{fmtRetenue(bulletin.impot)}</span>
              </Td>
              <Td aligne="droite" chiffres fort>
                {fmt(bulletin.net)}
              </Td>
              <Td aligne="droite" chiffres>
                <span className="text-[var(--encre-faible)]">
                  {fmt(bulletin.coutTotal)}
                </span>
              </Td>
            </tr>
          ))}

          <tr className="bg-[var(--surface-creuse)]">
            <Td>{""}</Td>
            <Td fort>Totaux</Td>
            <Td aligne="droite" chiffres fort>
              {fmt(brut)}
            </Td>
            <Td aligne="droite" chiffres fort>
              {fmtRetenue(BULLETINS.reduce((s, b) => s + b.cotisationsSalariales, 0))}
            </Td>
            <Td aligne="droite" chiffres fort>
              {fmtRetenue(BULLETINS.reduce((s, b) => s + b.impot, 0))}
            </Td>
            <Td aligne="droite" chiffres fort>
              {fmt(net)}
            </Td>
            <Td aligne="droite" chiffres fort>
              {fmt(BULLETINS.reduce((s, b) => s + b.coutTotal, 0))}
            </Td>
          </tr>
        </tbody>
      </Tableau>

      <p className="chiffres mt-4 text-xs text-[var(--encre-faible)]">
        Retraite CNPS {fmtTaux(BAREME_CI.cnpsRetraiteSalarie)} % salarié et{" "}
        {fmtTaux(BAREME_CI.cnpsRetraitePatronal)} % employeur, plafonnée à{" "}
        {fmt(BAREME_CI.cnpsPlafondMensuel)} FCFA par mois. Prestations familiales{" "}
        {fmtTaux(BAREME_CI.prestationsFamiliales)} % et accident du travail{" "}
        {fmtTaux(BAREME_CI.accidentTravail)} %, à la charge de l&apos;employeur.
      </p>
    </>
  );
}
