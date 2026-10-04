import type { Metadata } from "next";

import {
  CarteIndicateur,
  EnTetePage,
  EtatVide,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmt, fmtCompact, fmtRetenue, fmtTauxBp } from "@/lib/format";
import { BAREME_CI, calculerBulletin } from "@/modules/personnes/paie";
import { listerSalaries } from "@/modules/personnes/requetes";

export const metadata: Metadata = { title: "Paie" };

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Bulletins du mois.
 *
 * La colonne qui compte est le net à payer, et il est toujours inférieur au
 * brut. Cela paraît évident ; la capture marketing du concurrent affiche
 * pourtant un net supérieur au brut sur chacune de ses lignes — 120 000 de
 * brut, 13 420 de retenues, 132 000 de net. Le total et le détail y sont
 * remplis par deux calculs différents.
 *
 * Ces bulletins sont CALCULÉS depuis la base, pas encore ÉMIS : aucune ligne
 * n'est enregistrée, aucune écriture n'est passée. Émettre un bulletin figera
 * son montant, comme un ticket de caisse fige le sien — et cela n'a de sens
 * qu'une fois le barème réel vérifié.
 */
export default async function PagePaie() {
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

  const maintenant = new Date();
  const periode = `${MOIS[maintenant.getMonth()]} ${maintenant.getFullYear()}`;

  const brut = bulletins.reduce((s, b) => s + b.brut, 0);
  const retenues = bulletins.reduce(
    (s, b) => s + b.cotisationsSalariales + b.impot,
    0,
  );
  const net = bulletins.reduce((s, b) => s + b.net, 0);
  const patronales = bulletins.reduce((s, b) => s + b.chargesPatronales, 0);

  return (
    <>
      <EnTetePage
        titre="Paie"
        sousTitre={`${periode} · bulletins calculés, non émis`}
      />

      {BAREME_CI.aVerifier && (
        <p className="mb-5 rounded-xl border-l-4 border-alerte-500 bg-alerte-50 px-4 py-3 text-sm text-alerte-600">
          <strong className="font-semibold">Barèmes de démonstration.</strong> Les
          taux CNPS et le barème ITS employés ici doivent être vérifiés auprès des
          administrations et confrontés à des bulletins réels avant toute mise en
          production. Tant qu&apos;ils ne le sont pas, aucun bulletin n&apos;est
          émis et aucune écriture de paie n&apos;est passée.
        </p>
      )}

      {bulletins.length === 0 ? (
        <EtatVide
          titre="Aucun bulletin"
          message="La paie se calcule sur les salariés inscrits. Inscrivez-en un dans l'onglet Salariés — les intervenants, eux, ne relèvent pas de la paie mais du bon de paiement."
        />
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2">
            <CarteIndicateur
              libelle="Masse brute"
              valeur={fmtCompact(brut)}
              unite="FCFA"
            />
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
              {bulletins.map((bulletin) => (
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
                  {fmtRetenue(
                    bulletins.reduce((s, b) => s + b.cotisationsSalariales, 0),
                  )}
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmtRetenue(bulletins.reduce((s, b) => s + b.impot, 0))}
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmt(net)}
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmt(bulletins.reduce((s, b) => s + b.coutTotal, 0))}
                </Td>
              </tr>
            </tbody>
          </Tableau>

          <p className="chiffres mt-4 text-xs text-[var(--encre-faible)]">
            Retraite CNPS {fmtTauxBp(BAREME_CI.cnpsRetraiteSalarieBp)} salarié et{" "}
            {fmtTauxBp(BAREME_CI.cnpsRetraitePatronalBp)} employeur, plafonnée à{" "}
            {fmt(BAREME_CI.cnpsPlafondMensuel)} FCFA par mois. Prestations
            familiales {fmtTauxBp(BAREME_CI.prestationsFamilialesBp)} et accident
            du travail {fmtTauxBp(BAREME_CI.accidentTravailBp)}, à la charge de
            l&apos;employeur.
          </p>
        </>
      )}
    </>
  );
}
