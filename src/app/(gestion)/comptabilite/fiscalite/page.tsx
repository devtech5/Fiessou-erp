import type { Metadata } from "next";
import Link from "next/link";

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
import { peut } from "@/lib/droits/garde";
import { fmt, fmtCompact } from "@/lib/format";
import type { ObligationTva, StatutTva } from "@/modules/fiscalite/calcul";
import { calendrierTva, exercicesFiscaux } from "@/modules/fiscalite/requetes";
import { db } from "@/db";
import { echeanceDeclarations, libelleMois } from "@/modules/paie/calcul";
import { listerPeriodes } from "@/modules/paie/requetes";
import { listerComptes } from "@/modules/tresorerie/requetes";

import { ActionTva, CloturerExercice } from "./actions-fiscalite";

export const metadata: Metadata = { title: "Fiscalité" };

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const date = (v: string | Date) => JOUR.format(v instanceof Date ? v : new Date(`${String(v).slice(0, 10)}T00:00:00Z`));

const STATUT: Record<StatutTva, { libelle: string; ton: TonPastille }> = {
  en_cours: { libelle: "Mois en cours", ton: "neutre" },
  a_declarer: { libelle: "À déclarer", ton: "marque" },
  en_retard: { libelle: "Non déclarée, en retard", ton: "danger" },
  a_payer: { libelle: "À payer", ton: "alerte" },
  payee: { libelle: "Payée", ton: "valide" },
  credit: { libelle: "Crédit reporté", ton: "valide" },
  neant: { libelle: "Néant", ton: "neutre" },
};

function statut(o: ObligationTva) {
  if (o.statut === "a_payer" && o.enRetard) return { libelle: "À payer, en retard", ton: "danger" as TonPastille };
  return STATUT[o.statut];
}

/**
 * Obligations fiscales et sociales — référentiel ivoirien : TVA à la DGI,
 * cotisations à la CNPS, impôt sur salaires, clôture de l'exercice.
 *
 * Rien n'y est saisi. La TVA se lit dans les écritures (443 collectée, 445
 * déductible), la paie apporte ses versements, le résultat sort du grand
 * livre. Le concurrent affiche en Côte d'Ivoire la DGID, l'IPRES et le TRIMF
 * sénégalais : un commerçant d'Abidjan n'en a que faire.
 */
export default async function PageFiscalite() {
  const session = await exigerEntreprise();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [declarer, cloturer, voitPaie] = await Promise.all([
    peut("comptabilite.fiscalite.declarer"),
    peut("comptabilite.exercice.cloturer"),
    peut("personnes.consulter"),
  ]);
  const calendrier = await calendrierTva(db, session.organizationId, aujourdhui);
  const [exercices, periodes, comptes] = await Promise.all([
    exercicesFiscaux(session.organizationId, aujourdhui, calendrier),
    voitPaie ? listerPeriodes(session.organizationId) : Promise.resolve([]),
    declarer ? listerComptes(session.organizationId) : Promise.resolve([]),
  ]);
  const comptesActifs = comptes.filter((c) => c.actif).map((c) => ({ id: c.id, nom: c.nom, nature: c.nature, solde: c.solde }));

  const aDeclarer = calendrier.filter((o) => o.statut === "a_declarer" || o.statut === "en_retard");
  const dus = calendrier.filter((o) => o.statut === "a_payer");
  const derniereDeclaree = calendrier.filter((o) => o.declaree).at(-1);
  const enCours = exercices.find((e) => e.exercice === aujourdhui.slice(0, 4)) ?? exercices[0];
  const paieValidee = periodes.filter((p) => p.statut === "validee");

  return (
    <>
      <EnTetePage titre="Fiscalité" sousTitre="TVA, charges sociales et clôture · DGI et CNPS" />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur
          libelle="TVA à déclarer"
          valeur={String(aDeclarer.length)}
          unite="mois"
          ton={aDeclarer.some((o) => o.enRetard) ? "danger" : aDeclarer.length > 0 ? "alerte" : "valide"}
          precision={aDeclarer.length > 0 ? `À partir de ${libelleMois(aDeclarer[0].mois)}` : "Tous les mois terminés sont déclarés"}
        />
        <CarteIndicateur
          libelle="TVA due à la DGI"
          valeur={fmtCompact(dus.reduce((s, o) => s + o.liquidation.aPayer, 0))}
          unite="FCFA"
          ton={dus.some((o) => o.enRetard) ? "danger" : dus.length > 0 ? "alerte" : "neutre"}
          precision={dus.length > 0 ? `${dus.length} déclaration${dus.length > 1 ? "s" : ""} non payée${dus.length > 1 ? "s" : ""}` : "Rien de déclaré en attente"}
        />
        <CarteIndicateur
          libelle="Crédit de TVA"
          valeur={fmtCompact(derniereDeclaree?.liquidation.creditReporte ?? 0)}
          unite="FCFA"
          ton="neutre"
          precision={derniereDeclaree ? `Reporté après ${libelleMois(derniereDeclaree.mois)}` : "Aucune déclaration déposée"}
        />
        <CarteIndicateur
          libelle={enCours ? `Résultat ${enCours.exercice}` : "Résultat"}
          valeur={fmtCompact(enCours?.resultat ?? 0)}
          unite="FCFA"
          ton={(enCours?.resultat ?? 0) < 0 ? "danger" : "valide"}
          precision={enCours?.clos ? "Exercice clôturé" : "Provisoire, d'après les écritures"}
        />
      </section>

      <h2 className="mb-2 text-sm font-semibold">TVA mensuelle</h2>
      {calendrier.length === 0 ? (
        <EtatVide titre="Aucune TVA comptabilisée" message="La TVA apparaît ici dès qu'une vente, une facture ou un achat passe une écriture sur les comptes 443 ou 445." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Mois</Th>
              <Th aligne="droite">Collectée</Th>
              <Th aligne="droite">Déductible</Th>
              <Th aligne="droite">Crédit antérieur</Th>
              <Th aligne="droite">À payer · crédit</Th>
              <Th>Échéance</Th>
              <Th>Statut</Th>
              <Th aligne="droite">{declarer ? "Action" : ""}</Th>
            </tr>
          </thead>
          <tbody>
            {[...calendrier].reverse().map((o) => {
              const s = statut(o);
              const l = o.liquidation;
              return (
                <tr key={o.mois}>
                  <Td fort>
                    {libelleMois(o.mois)}
                    {!o.declaree && o.statut !== "en_cours" && <span className="block text-[11px] font-normal text-[var(--encre-faible)]">Estimation</span>}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {fmt(l.collectee)}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {fmt(l.deductible)}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {l.creditAnterieur ? fmt(l.creditAnterieur) : "—"}
                  </Td>
                  <Td aligne="droite" chiffres fort>
                    {l.aPayer > 0 ? fmt(l.aPayer) : l.creditReporte > 0 ? <span className="text-valide-600">crédit {fmt(l.creditReporte)}</span> : "0"}
                  </Td>
                  <Td chiffres>
                    <span className={o.enRetard ? "font-semibold text-danger-600" : ""}>{date(o.echeance)}</span>
                  </Td>
                  <Td>
                    <Pastille ton={s.ton}>{s.libelle}</Pastille>
                  </Td>
                  <Td aligne="droite">
                    {declarer && o.declarable && <ActionTva mois={o.mois} geste="declarer" aPayer={l.aPayer} comptes={comptesActifs} aujourdhui={aujourdhui} />}
                    {declarer && o.statut === "a_payer" && <ActionTva mois={o.mois} geste="payer" aPayer={l.aPayer} comptes={comptesActifs} aujourdhui={aujourdhui} />}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tableau>
      )}

      {voitPaie && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold">Charges sociales et impôt sur salaires</h2>
          {paieValidee.length === 0 ? (
            <EtatVide titre="Aucune paie validée" message="Les versements à la CNPS et l'impôt retenu sur les salaires apparaissent ici une fois la paie du mois validée." />
          ) : (
            <Tableau>
              <thead>
                <tr>
                  <Th>Mois</Th>
                  <Th aligne="droite">CNPS</Th>
                  <Th>Versée</Th>
                  <Th aligne="droite">Impôt sur salaires</Th>
                  <Th>Versé</Th>
                  <Th>Échéance</Th>
                </tr>
              </thead>
              <tbody>
                {paieValidee.map((p) => {
                  const echue = echeanceDeclarations(p.mois) < aujourdhui;
                  const versement = (le: string | null, montant: number) =>
                    le ? <Pastille ton="valide">{date(le)}</Pastille> : montant > 0 ? <Pastille ton={echue ? "danger" : "alerte"}>{echue ? "En retard" : "À verser"}</Pastille> : "—";
                  return (
                    <tr key={p.id}>
                      <Td fort>
                        <Link href={`/rh/paie?mois=${p.mois}`} className="hover:underline">
                          {libelleMois(p.mois)}
                        </Link>
                      </Td>
                      <Td aligne="droite" chiffres>
                        {fmt(p.totalCnps)}
                      </Td>
                      <Td>{versement(p.cnpsVerseeLe, p.totalCnps)}</Td>
                      <Td aligne="droite" chiffres>
                        {fmt(p.totalImpot)}
                      </Td>
                      <Td>{versement(p.impotVerseLe, p.totalImpot)}</Td>
                      <Td chiffres>{date(echeanceDeclarations(p.mois))}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tableau>
          )}
        </>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold">Exercices</h2>
      {exercices.length === 0 ? (
        <EtatVide titre="Aucun exercice" message="Un exercice existe dès la première écriture de l'année." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Exercice</Th>
              <Th aligne="droite">Résultat</Th>
              <Th>État</Th>
              <Th aligne="droite">{cloturer ? "Clôture" : ""}</Th>
            </tr>
          </thead>
          <tbody>
            {exercices.map((e) => (
              <tr key={e.exercice}>
                <Td fort>{e.exercice}</Td>
                <Td aligne="droite" chiffres fort>
                  <span className={e.resultat < 0 ? "text-danger-600" : ""}>{fmt(e.resultat)}</span>
                </Td>
                <Td>
                  {e.clos ? (
                    <Pastille ton="valide">Clôturé{e.clotureLe ? ` le ${date(e.clotureLe)}` : ""} · {e.ecriture}</Pastille>
                  ) : (
                    <Pastille ton="neutre">Ouvert</Pastille>
                  )}
                </Td>
                <Td aligne="droite">
                  {cloturer && !e.clos && (e.refus ? <span className="block max-w-[38ch] text-right text-xs text-[var(--encre-faible)]">{e.refus}</span> : <CloturerExercice exercice={e.exercice} resultat={e.resultat} />)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Les montants de TVA sont calculés depuis les écritures, jamais ressaisis. Une déclaration déposée passe la liquidation (443 et 445 soldés en 4441 ou 4449) et
        verrouille le mois : aucune écriture portant de la TVA ne peut plus y être datée. L&apos;échéance indiquée est le 15 du mois suivant — à confirmer selon votre régime
        auprès de la DGI. Un exercice clôturé n&apos;accepte plus aucune écriture.
      </p>
    </>
  );
}
