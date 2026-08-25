import type { Metadata } from "next";

import {
  CarteIndicateur,
  EnTetePage,
  Pastille,
  type TonPastille,
} from "@/components/ui/primitives";
import {
  LIBELLE_ETAT,
  etapeEnAttente,
  etatCourant,
  etapesFranchies,
  type EtatDemande,
} from "@/lib/approbation/circuit";
import { fmt, fmtEntier } from "@/lib/format";
import {
  BONS,
  CAISSES,
  LIBELLE_NATURE,
  aRegulariser,
  caisse,
  personne,
  reliquat,
} from "@/lib/fixtures/caisse-depenses";
import { DemandeBon } from "./demande-bon";

export const metadata: Metadata = { title: "Caisse de dépenses" };

const TON: Record<EtatDemande, TonPastille> = {
  brouillon: "neutre",
  soumise: "marque",
  en_validation: "alerte",
  approuvee: "valide",
  refusee: "danger",
  executee: "neutre",
  annulee: "neutre",
};

export default function PageCaisseDepenses() {
  const etats = BONS.map((bon) => ({
    bon,
    etat: etatCourant(bon.circuit, Boolean(bon.decaisseLe)),
  }));

  const enAttente = etats.filter(
    (e) => e.etat === "soumise" || e.etat === "en_validation",
  );
  const aDecaisser = etats.filter((e) => e.etat === "approuvee");
  const regularisations = BONS.filter(aRegulariser);

  const montantEnAttente = enAttente.reduce((s, e) => s + e.bon.montant, 0);
  const montantADecaisser = aDecaisser.reduce((s, e) => s + e.bon.montant, 0);

  // Un reliquat positif est une somme qu'un employé doit rendre.
  const reliquats = BONS.map(reliquat).filter(
    (r): r is number => r !== null && r > 0,
  );
  const totalReliquats = reliquats.reduce((s, r) => s + r, 0);

  return (
    <>
      <EnTetePage
        titre="Caisse de dépenses"
        sousTitre="Bons de décaissement et réserves d'espèces"
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="En attente de validation"
          valeur={fmtEntier(enAttente.length)}
          ton={enAttente.length > 0 ? "alerte" : "valide"}
          precision={`${fmt(montantEnAttente)} FCFA engagés`}
        />
        <CarteIndicateur
          libelle="Approuvés, non décaissés"
          valeur={fmtEntier(aDecaisser.length)}
          ton={aDecaisser.length > 0 ? "marque" : "valide"}
          precision={`${fmt(montantADecaisser)} FCFA à remettre`}
        />
        <CarteIndicateur
          libelle="À régulariser"
          valeur={fmtEntier(regularisations.length)}
          ton={regularisations.length > 0 ? "danger" : "valide"}
          precision="Décaissés sans justificatif"
        />
        <CarteIndicateur
          libelle="Reliquats dus"
          /* Montant exact, jamais abrégé : c'est une somme réclamée à quelqu'un,
             et « 35 k » ne se réclame pas. */
          valeur={fmt(totalReliquats)}
          unite="FCFA"
          ton={totalReliquats > 0 ? "alerte" : "valide"}
          precision="Avances non soldées"
        />
      </section>

      {/* ------------------------------------------------------ les caisses */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-base font-semibold">Réserves d&apos;espèces</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CAISSES.map((k) => {
            const bas = k.solde < k.seuilAlerte;
            return (
              <li
                key={k.id}
                className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{k.nom}</p>
                    <p className="chiffres text-xs text-[var(--encre-faible)]">
                      {k.code} · compte {k.compte} · {k.responsable}
                    </p>
                  </div>
                  {bas && <Pastille ton="alerte">À réalimenter</Pastille>}
                </div>
                <p
                  className={`chiffres mt-2 text-xl font-bold ${bas ? "text-alerte-600" : ""}`}
                >
                  {fmt(k.solde)}
                  <span className="ml-1 text-xs font-medium text-[var(--encre-faible)]">
                    FCFA
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-[var(--encre-faible)]">
          Ces réserves sont distinctes des caisses du point de vente : elles ne
          reçoivent pas les ventes et ne se clôturent pas avec elles.
        </p>
      </section>

      <DemandeBon />

      {/* --------------------------------------------------------- les bons */}
      <section>
        <h2 className="mb-2.5 text-base font-semibold">Bons de caisse</h2>

        <ul className="grid gap-2 lg:grid-cols-2">
          {etats.map(({ bon, etat }) => {
            const emetteur = personne(bon.emetteurId);
            const attente = etapeEnAttente(bon.circuit);
            const reste = reliquat(bon);

            return (
              <li
                key={bon.id}
                className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="chiffres text-xs text-[var(--encre-faible)]">
                      {bon.numero} · {LIBELLE_NATURE[bon.nature]} ·{" "}
                      {caisse(bon.caisseId).code}
                    </p>
                    <p className="truncate text-sm font-semibold">{bon.objet}</p>
                    <p className="truncate text-xs text-[var(--encre-douce)]">
                      {emetteur.nom} — {emetteur.fonction} · {bon.dateDemande}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <Pastille ton={TON[etat]}>{LIBELLE_ETAT[etat]}</Pastille>
                    <p className="chiffres mt-1 text-base font-bold">
                      {fmt(bon.montant)}
                    </p>
                  </div>
                </div>

                {/* Le circuit reste visible à toutes les étapes : c'est lui
                    qui dit à qui réclamer une signature en retard. */}
                <ol className="mt-3 space-y-1.5 border-t border-[var(--filet)] pt-2.5">
                  {bon.circuit.map((etape, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-sm">
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          etape.decision === "approuve"
                            ? "bg-valide-500 text-white"
                            : etape.decision === "refuse"
                              ? "bg-danger-500 text-white"
                              : "bg-[var(--surface-creuse)] text-[var(--encre-faible)]"
                        }`}
                        aria-hidden
                      >
                        {etape.decision === "approuve"
                          ? "✓"
                          : etape.decision === "refuse"
                            ? "✕"
                            : index + 1}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {etape.parNom ?? etape.valideurNom}
                          <span className="ml-1.5 text-xs text-[var(--encre-faible)]">
                            {etape.role === "superieur" ? "supérieur" : "direction"}
                          </span>
                        </span>
                        {etape.motif && (
                          <span className="block text-xs text-danger-600">
                            {etape.motif}
                          </span>
                        )}
                      </span>

                      <span className="chiffres shrink-0 text-xs text-[var(--encre-faible)]">
                        {etape.le ?? "en attente"}
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--filet)] pt-2.5 text-xs">
                  {bon.decaisseLe ? (
                    <span className="chiffres text-[var(--encre-faible)]">
                      Décaissé le {bon.decaisseLe} par {bon.decaissePar}
                    </span>
                  ) : attente ? (
                    <span className="text-[var(--encre-faible)]">
                      {etapesFranchies(bon.circuit)} / {bon.circuit.length} ·
                      attend {attente.valideurNom}
                    </span>
                  ) : etat === "approuvee" ? (
                    <span className="font-semibold text-marque-600">
                      Prêt à décaisser
                    </span>
                  ) : null}

                  {aRegulariser(bon) && (
                    <Pastille ton="danger">Justificatif manquant</Pastille>
                  )}

                  {reste !== null && reste > 0 && bon.justificatif !== undefined && (
                    <Pastille ton="alerte">
                      Reliquat {fmt(reste)} à rendre
                    </Pastille>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-5 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Approuver un bon n&apos;est pas le payer. L&apos;écriture comptable naît au
        décaissement, quand l&apos;argent quitte réellement la caisse, et jamais à
        la signature. Un bon approuvé mais non décaissé n&apos;a encore rien coûté.
      </p>
    </>
  );
}
