import type { Metadata } from "next";
import Link from "next/link";

import { BoutonDemonstration } from "@/components/bouton-demonstration";
import { FormulaireRepliable } from "@/components/ui/operations";
import {
  CarteIndicateur,
  Champ,
  CLASSE_CHAMP,
  EnTetePage,
  EtatVide,
  Pastille,
  type TonPastille,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtCompact, fmtEntier } from "@/lib/format";
import { creerProjet } from "@/modules/projets/actions";
import { LIBELLE_STATUT_PROJET } from "@/modules/projets/calcul";
import { listerProjets, membresActifs } from "@/modules/projets/requetes";
import type { StatutProjet } from "@/modules/projets/schema";
import { listerTiers } from "@/modules/tiers/requetes";


export const metadata: Metadata = { title: "Projets" };

const TON: Record<StatutProjet, TonPastille> = {
  preparation: "neutre",
  en_cours: "marque",
  suspendu: "alerte",
  termine: "valide",
  annule: "neutre",
};

/**
 * Projets : à quoi l'argent a servi. Chaque carte dit le budget, ce qui est
 * engagé, ce qui est payé et ce qui attend une signature.
 */
export default async function PageProjets() {
  const session = await exigerEntreprise();
  const [projets, gerer, membres, clients] = await Promise.all([
    listerProjets(session.organizationId),
    peut("projet.gerer"),
    membresActifs(session.organizationId),
    listerTiers(session.organizationId, "client"),
  ]);

  const actifs = projets.filter((p) => p.statut === "en_cours" || p.statut === "preparation");
  const engage = actifs.reduce((s, p) => s + p.suivi.engage, 0);
  const enAttente = projets.reduce((s, p) => s + p.suivi.enAttente, 0);
  const depasses = actifs.filter((p) => p.suivi.reste !== null && p.suivi.reste < 0).length;

  return (
    <>
      <EnTetePage
        titre="Projets"
        sousTitre="Budget, dépenses et preuves, projet par projet"
        actions={
          gerer ? (
            <div className="flex flex-col items-end gap-2">
              {projets.length === 0 && <BoutonDemonstration libelle="Installer le jeu de démonstration" />}
              <FormulaireRepliable libelle="Nouveau projet" titre="Nouveau projet" action={creerProjet}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Champ libelle="Nom du projet">
                    <input name="nom" required placeholder="Ouverture boutique Yopougon" className={CLASSE_CHAMP} />
                  </Champ>
                  <Champ libelle="Responsable" precision="Il suit le projet et en rend compte.">
                    <select name="responsableUserId" className={CLASSE_CHAMP}>
                      <option value="">Non affecté</option>
                      {membres.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.nom}
                        </option>
                      ))}
                    </select>
                  </Champ>
                  <Champ libelle="Client (facultatif)">
                    <select name="clientId" className={CLASSE_CHAMP}>
                      <option value="">Projet interne</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </Champ>
                  <Champ libelle="Budget TTC" precision="Vide : pas de plafond.">
                    <input name="budget" inputMode="numeric" placeholder="2 500 000" className={`${CLASSE_CHAMP} chiffres`} />
                  </Champ>
                  <Champ libelle="Début">
                    <input name="debut" type="date" className={CLASSE_CHAMP} />
                  </Champ>
                  <Champ libelle="Fin prévue">
                    <input name="fin" type="date" className={CLASSE_CHAMP} />
                  </Champ>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Champ libelle="Description">
                      <textarea name="description" rows={2} className={`${CLASSE_CHAMP} h-auto py-2`} />
                    </Champ>
                  </div>
                </div>
              </FormulaireRepliable>
            </div>
          ) : undefined
        }
      />

      {projets.length === 0 ? (
        <EtatVide
          titre="Aucun projet"
          message="Un projet regroupe des dépenses : un chantier, une ouverture de boutique, un aménagement. Chaque achat s'y rattache avec sa preuve."
        />
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CarteIndicateur libelle="Projets actifs" valeur={fmtEntier(actifs.length)} precision={`${projets.length} au total`} />
            <CarteIndicateur libelle="Engagé sur les projets actifs" valeur={fmtCompact(engage)} unite="FCFA" />
            <CarteIndicateur
              libelle="Demandes à approuver"
              valeur={fmtCompact(enAttente)}
              unite="FCFA"
              ton={enAttente > 0 ? "alerte" : "valide"}
            />
            <CarteIndicateur libelle="Budgets dépassés" valeur={fmtEntier(depasses)} ton={depasses > 0 ? "danger" : "valide"} />
          </section>

          <ul className="grid gap-2 lg:grid-cols-2">
            {projets.map((p) => {
              const taux = p.suivi.taux ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    href={`/projets/${p.id}`}
                    className="block rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 hover:border-marque-400"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="chiffres text-xs text-[var(--encre-faible)]">
                          {p.code}
                          {p.client ? ` · ${p.client}` : ""}
                        </p>
                        <p className="truncate text-sm font-semibold">{p.nom}</p>
                      </div>
                      <Pastille ton={TON[p.statut]}>{LIBELLE_STATUT_PROJET[p.statut]}</Pastille>
                    </div>
                    <p className="mt-1 text-xs text-[var(--encre-douce)]">
                      {p.responsable ? `Responsable : ${p.responsable}` : "Non affecté"} · {p.depenses} dépense
                      {p.depenses > 1 ? "s" : ""} · {p.photos} photo{p.photos > 1 ? "s" : ""}
                    </p>

                    <div className="mt-3">
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-[var(--encre-faible)]">
                          {fmt(p.suivi.engage)} engagés{p.budget !== null ? ` sur ${fmt(p.budget)}` : ""} · {fmt(p.suivi.paye)} payés
                        </span>
                        {p.suivi.taux !== null && <span className="chiffres font-semibold">{taux} %</span>}
                      </div>
                      {p.budget !== null && (
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-creuse)]"
                          role="progressbar"
                          aria-valuenow={taux}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Budget consommé du projet ${p.code}`}
                        >
                          <div
                            className={`h-full rounded-full ${taux > 100 ? "bg-danger-600" : taux >= 85 ? "bg-alerte-500" : "bg-marque-600"}`}
                            style={{ width: `${Math.min(100, taux)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {p.suivi.enAttente > 0 && (
                      <p className="mt-2 text-xs font-medium text-alerte-600">{fmt(p.suivi.enAttente)} F en attente d&apos;approbation</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
