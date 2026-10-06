import type { Metadata } from "next";

import { ActionsConge, FormulaireConge } from "@/components/presences/formulaires";
import { CarteIndicateur, EnTetePage, Pastille, Tableau, Td, Th, type TonPastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { droitsActifs } from "@/lib/droits/garde";
import { STATUTS_CONGE, formatJours, jourLocal } from "@/modules/presences/calcul";
import { reglagesDe, salarieDuCompte } from "@/modules/presences/creation";
import { listerConges, salariesSur, soldesConges, type LigneConge } from "@/modules/presences/requetes";

export const metadata: Metadata = { title: "Congés" };

const TON: Record<LigneConge["statut"], TonPastille> = { demande: "alerte", approuve: "valide", refuse: "danger", annule: "neutre" };

function periode(c: LigneConge): string {
  const f = (j: string) => j.split("-").reverse().join("/");
  const d = `${f(c.debut)}${c.debutDemi ? " (après-midi)" : ""}`;
  return c.debut === c.fin ? d : `${d} → ${f(c.fin)}${c.finDemi ? " (matin)" : ""}`;
}

function TableConges({ lignes, avecNom, peutDecider, userId, aujourdhui }: { lignes: LigneConge[]; avecNom: boolean; peutDecider: boolean; userId: string; aujourdhui: string }) {
  return (
    <Tableau>
      <thead>
        <tr>
          <Th>N°</Th>
          {avecNom && <Th>Salarié</Th>}
          <Th>Nature</Th>
          <Th>Période</Th>
          <Th aligne="droite">Jours</Th>
          <Th>Statut</Th>
          <Th aligne="droite"> </Th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((c) => {
          const sienne = c.salarieUserId === userId;
          const enCours = c.statut === "demande" || c.statut === "approuve";
          return (
            <tr key={c.id}>
              <Td chiffres>{c.numero}</Td>
              {avecNom && <Td fort>{c.nom}</Td>}
              <Td>
                {c.libelleNature}
                {c.motif && <span className="block text-xs text-[var(--encre-faible)]">{c.motif}</span>}
              </Td>
              <Td chiffres>{periode(c)}</Td>
              <Td aligne="droite" chiffres>
                {formatJours(c.jours)}
              </Td>
              <Td>
                <Pastille ton={TON[c.statut]}>{STATUTS_CONGE[c.statut]}</Pastille>
                {c.commentaire && <span className="block text-xs text-[var(--encre-faible)]">{c.commentaire}</span>}
              </Td>
              <Td aligne="droite">
                <ActionsConge
                  id={c.id}
                  peutDecider={peutDecider && c.statut === "demande"}
                  peutAnnuler={enCours && (peutDecider || (sienne && c.debut > aujourdhui))}
                  aJustificatif={c.aJustificatif}
                />
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Tableau>
  );
}

export default async function PageConges() {
  const session = await exigerEntreprise();
  const droits = await droitsActifs();
  const r = await reglagesDe(session.organizationId);
  const aujourdhui = jourLocal(new Date(), r.fuseau);
  const valideur = droits.has("conges.valider");
  const moi = await salarieDuCompte(session.organizationId, session.userId);

  const [mesConges, [monSolde], aDecider, tous, salaries] = await Promise.all([
    moi ? listerConges(session.organizationId, { employeeId: moi.id }) : Promise.resolve([]),
    moi ? soldesConges(session.organizationId, r, aujourdhui, [moi.id]) : Promise.resolve([]),
    valideur ? listerConges(session.organizationId, { statuts: ["demande"] }) : Promise.resolve([]),
    valideur ? listerConges(session.organizationId, { statuts: ["approuve", "refuse", "annule"], limite: 100 }) : Promise.resolve([]),
    valideur ? salariesSur(session.organizationId, aujourdhui, aujourdhui) : Promise.resolve([]),
  ]);

  return (
    <>
      <EnTetePage
        titre="Congés"
        sousTitre={`${formatJours(r.congesCentiemesParMois)} acquis par mois de service · décompte en jours ${r.decompte === "ouvrables" ? "ouvrables" : "travaillés"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {moi && droits.has("conges.demander") && <FormulaireConge aujourdhui={aujourdhui} pourMoi />}
            {valideur && <FormulaireConge salaries={salaries.map((s) => ({ id: s.id, nom: s.nom }))} aujourdhui={aujourdhui} pourMoi={false} />}
          </div>
        }
      />

      {moi && monSolde && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CarteIndicateur libelle="Disponible" valeur={formatJours(monSolde.solde)} ton="marque" precision={`Depuis le ${monSolde.depuis.split("-").reverse().join("/")}`} />
          <CarteIndicateur libelle="Acquis" valeur={formatJours(monSolde.acquis)} />
          <CarteIndicateur libelle="Pris" valeur={formatJours(monSolde.pris)} />
          <CarteIndicateur libelle="En attente" valeur={formatJours(monSolde.enAttente)} ton={monSolde.enAttente ? "alerte" : "neutre"} />
        </div>
      )}
      {!moi && !valideur && (
        <p className="mb-6 rounded-xl border border-dashed border-[var(--filet)] bg-[var(--surface)] p-5 text-sm text-[var(--encre-douce)]">
          Votre compte n&apos;est rattaché à aucune fiche salarié : demandez à votre responsable de vous rattacher depuis Personnel pour demander vos congés.
        </p>
      )}

      {valideur && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold">
            À décider <span className="chiffres font-normal text-[var(--encre-faible)]">{aDecider.length}</span>
          </h2>
          {aDecider.length ? (
            <TableConges lignes={aDecider} avecNom peutDecider userId={session.userId} aujourdhui={aujourdhui} />
          ) : (
            <p className="text-sm text-[var(--encre-faible)]">Aucune demande en attente.</p>
          )}
        </section>
      )}

      {moi && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold">Mes demandes</h2>
          {mesConges.length ? (
            <TableConges lignes={mesConges} avecNom={false} peutDecider={false} userId={session.userId} aujourdhui={aujourdhui} />
          ) : (
            <p className="text-sm text-[var(--encre-faible)]">Aucune demande pour l&apos;instant.</p>
          )}
        </section>
      )}

      {valideur && tous.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Historique de l&apos;équipe</h2>
          <TableConges lignes={tous} avecNom peutDecider userId={session.userId} aujourdhui={aujourdhui} />
        </section>
      )}
    </>
  );
}
