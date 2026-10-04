import type { Metadata } from "next";

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
import { fmt, fmtEntier } from "@/lib/format";
import { listerBillets } from "@/modules/billetterie/requetes";
import type { StatutBillet } from "@/modules/billetterie/schema";

import { correspond, Recherche } from "@/components/ui/recherche";

import { AnnulationBillet, ControleEmbarquement } from "../outils";

export const metadata: Metadata = { title: "Billets" };

const TON: Record<StatutBillet, TonPastille> = {
  valide: "marque",
  embarque: "valide",
  annule: "neutre",
  non_presente: "danger",
};

const LIBELLE: Record<StatutBillet, string> = {
  valide: "Valide",
  embarque: "Embarqué",
  annule: "Annulé",
  non_presente: "Non présenté",
};

const MOMENT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * Billets émis et contrôle à l'embarquement.
 *
 * Le billet est nominatif et porte son siège : c'est ce couple qui se contrôle
 * à la montée. Un billet resté « valide » au départ du car devient « non
 * présenté » : la place est perdue, la recette reste.
 */
export default async function PageBillets({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await exigerEntreprise();
  const { q = "" } = await searchParams;
  const [billets, controler, annuler] = await Promise.all([
    listerBillets(session.organizationId),
    peut("billetterie.billet.vendre"),
    peut("billetterie.billet.annuler"),
  ]);

  const actifs = billets.filter((b) => b.statut !== "annule");
  const valides = billets.filter((b) => b.statut === "valide");
  const embarques = billets.filter((b) => b.statut === "embarque");
  const absents = billets.filter((b) => b.statut === "non_presente");
  const recette = actifs.reduce((s, b) => s + b.montant, 0);
  const affiches = billets.filter((b) => correspond(q, [b.numero, b.passager, b.telephone, b.piece, b.trajet, b.reference, b.siege]));

  return (
    <>
      <EnTetePage titre="Billets" sousTitre="Émission et contrôle à l'embarquement" />

      {controler && <ControleEmbarquement />}

      {billets.length === 0 ? (
        <EtatVide titre="Aucun billet émis" message="Les billets vendus au plan de places apparaissent ici." />
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2">
            <CarteIndicateur
              libelle="Billets émis"
              valeur={fmtEntier(actifs.length)}
              precision={`${fmt(recette)} FCFA encaissés`}
            />
            <CarteIndicateur
              libelle="À embarquer"
              valeur={fmtEntier(valides.length)}
              ton="marque"
              precision={`${embarques.length} déjà montés à bord`}
            />
            <CarteIndicateur
              libelle="Non présentés"
              valeur={fmtEntier(absents.length)}
              ton={absents.length > 0 ? "danger" : "valide"}
              precision="Places perdues au départ"
            />
            <CarteIndicateur
              libelle="Annulés"
              valeur={fmtEntier(billets.length - actifs.length)}
              precision="Remboursés, recette contrepassée"
            />
          </section>

          <Recherche
            chemin="/billetterie/billets"
            valeur={q}
            placeholder="Numéro, passager, téléphone, pièce, trajet"
            resultats={q.trim() ? `${affiches.length} sur ${billets.length}` : undefined}
          />
          <Tableau>
            <thead>
              <tr>
                <Th>Numéro</Th>
                <Th>Passager</Th>
                <Th>Trajet</Th>
                <Th aligne="droite">Siège</Th>
                <Th>Pièce</Th>
                <Th>Statut</Th>
                <Th aligne="droite">Montant</Th>
                {annuler && <Th aligne="droite"> </Th>}
              </tr>
            </thead>
            <tbody>
              {affiches.map((billet) => (
                <tr key={billet.id}>
                  <Td chiffres fort>
                    {billet.numero}
                  </Td>
                  <Td>
                    {billet.passager}
                    {billet.telephone && (
                      <span className="chiffres block text-xs text-[var(--encre-faible)]">{billet.telephone}</span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--encre-douce)]">{billet.trajet}</span>
                    <span className="chiffres block text-xs text-[var(--encre-faible)]">
                      {billet.reference} · {MOMENT.format(billet.partLe)}
                    </span>
                  </Td>
                  <Td aligne="droite" chiffres fort>
                    {billet.siege}
                  </Td>
                  <Td chiffres>
                    {/* Sans pièce relevée à la vente, le contrôle ne peut pas
                        vérifier que le porteur est bien le titulaire. */}
                    {billet.piece ?? <span className="text-xs text-[var(--encre-faible)]">Non relevée</span>}
                  </Td>
                  <Td>
                    <Pastille ton={TON[billet.statut]}>{LIBELLE[billet.statut]}</Pastille>
                    {billet.motif && (
                      <span className="block max-w-48 truncate text-xs text-[var(--encre-faible)]" title={billet.motif}>
                        {billet.motif}
                      </span>
                    )}
                  </Td>
                  <Td aligne="droite" chiffres fort>
                    {billet.statut === "annule" ? (
                      <span className="text-[var(--encre-faible)] line-through">{fmt(billet.montant)}</span>
                    ) : (
                      fmt(billet.montant)
                    )}
                  </Td>
                  {annuler && (
                    <Td aligne="droite">
                      {billet.statut === "valide" && billet.statutDepart !== "parti" && (
                        <AnnulationBillet id={billet.id} numero={billet.numero} />
                      )}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Tableau>
        </>
      )}
    </>
  );
}
