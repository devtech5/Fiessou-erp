import type { Metadata } from "next";

import { BoutonMenage, FormulaireChambre, ReglageChambre } from "@/components/hotel/formulaires";
import { EnTetePage, EtatVide, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt } from "@/lib/format";
import { aujourdHuiPour } from "@/modules/hotellerie/creation";
import { tableauDesChambres } from "@/modules/hotellerie/requetes";

export const metadata: Metadata = { title: "Chambres et tarifs" };

const prix = (v: number | null) => (v === null ? "—" : fmt(v));

export default async function PageChambres() {
  const session = await exigerEntreprise();
  const jour = await aujourdHuiPour(session.organizationId);
  const [chambres, gerer, menage] = await Promise.all([
    tableauDesChambres(session.organizationId, jour),
    peut("hotellerie.chambre.gerer"),
    peut("hotellerie.menage"),
  ]);

  return (
    <>
      <EnTetePage titre="Chambres et tarifs" sousTitre="Numéro, étage, capacité et grille de prix" actions={gerer ? <FormulaireChambre /> : undefined} />

      {chambres.length === 0 ? (
        <EtatVide
          titre="Aucune chambre"
          message="Une chambre a un prix à la nuit ; une résidence meublée ajoute un forfait à la semaine ou au mois, et une caution rendue au départ."
        />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Chambre</Th>
              <Th>Étage</Th>
              <Th aligne="droite">Capacité</Th>
              <Th aligne="droite">Nuit</Th>
              <Th aligne="droite">Semaine</Th>
              <Th aligne="droite">Mois</Th>
              <Th aligne="droite">Caution</Th>
              <Th>État</Th>
              {(gerer || menage) && <Th aligne="droite">{""}</Th>}
            </tr>
          </thead>
          <tbody>
            {chambres.map((c) => (
              <tr key={c.id}>
                <Td fort>
                  <span className="chiffres">{c.code}</span>
                  <span className="block text-xs font-normal text-[var(--encre-faible)]">{c.categorie ?? c.designation}</span>
                </Td>
                <Td>{c.etage ?? "—"}</Td>
                <Td aligne="droite" chiffres>{c.capacite}</Td>
                <Td aligne="droite" chiffres>{prix(c.tarifNuit)}</Td>
                <Td aligne="droite" chiffres>{prix(c.tarifSemaine)}</Td>
                <Td aligne="droite" chiffres>{prix(c.tarifMois)}</Td>
                <Td aligne="droite" chiffres>{c.caution > 0 ? fmt(c.caution) : "—"}</Td>
                <Td>
                  {c.statut !== "active" ? (
                    <Pastille ton="danger">Hors service</Pastille>
                  ) : c.menage === "a_faire" ? (
                    <Pastille ton="alerte">À nettoyer</Pastille>
                  ) : (
                    <Pastille ton="valide">Prête</Pastille>
                  )}
                </Td>
                {(gerer || menage) && (
                  <Td aligne="droite">
                    <div className="flex flex-col items-end gap-1">
                      {menage && c.statut === "active" && <BoutonMenage ressourceId={c.id} menage={c.menage} />}
                      {gerer && <ReglageChambre ressourceId={c.id} enService={c.statut === "active"} etage={c.etage} capacite={c.capacite} />}
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
      <p className="mt-4 max-w-[70ch] text-xs text-[var(--encre-faible)]">
        Les prix s&apos;entendent TTC. Une chambre se loue aussi depuis l&apos;écran Réservations : les deux partagent le même calendrier,
        une chambre n&apos;est jamais vendue deux fois la même nuit.
      </p>
    </>
  );
}
