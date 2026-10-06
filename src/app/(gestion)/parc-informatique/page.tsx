import type { Metadata } from "next";
import Link from "next/link";

import { libelleEcheance } from "@/components/actifs/liste-echeances";
import { STATUT_ACTIF, TON_ECHEANCE } from "@/components/actifs/statut";
import { FormulaireNouvelEquipement } from "@/components/parc-informatique/formulaires";
import { CarteIndicateur, EnTetePage, EtatVide, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtCompact, fmtEntier } from "@/lib/format";
import { CATEGORIES_EQUIPEMENT } from "@/modules/parc-informatique/calcul";
import { listerEquipements, listerLicences } from "@/modules/parc-informatique/requetes";
import { salariesEnPoste } from "@/modules/personnes/requetes";

export const metadata: Metadata = { title: "Parc informatique" };

/**
 * Parc informatique : chaque équipement avec son utilisateur, sa fiche
 * technique et sa garantie. Les postes ouverts depuis l'écran Actifs
 * apparaissent aussi, fiche technique à compléter.
 */
export default async function PageParcInformatique() {
  const session = await exigerEntreprise();
  const [equipements, licences, utilisateurs, gerer] = await Promise.all([
    listerEquipements(session.organizationId),
    listerLicences(session.organizationId),
    salariesEnPoste(session.organizationId),
    peut("parc_informatique.equipement.gerer"),
  ]);

  const attribues = equipements.filter((e) => e.affecteA).length;
  const enPanne = equipements.filter((e) => e.statut === "immobilise" || e.statut === "entretien").length;
  const sousGarantie = equipements.filter((e) => e.garantie && e.garantie.gravite !== "depassee").length;
  const valeur = equipements.reduce((s, e) => s + e.valeurAcquisition, 0);
  const enDefaut = licences.filter((l) => l.etat !== "conforme").length;

  return (
    <>
      <EnTetePage
        titre="Parc informatique"
        sousTitre={equipements.length === 0 ? "Aucun équipement" : `${equipements.length} équipement${equipements.length > 1 ? "s" : ""} · ${attribues} attribué${attribues > 1 ? "s" : ""}`}
        actions={gerer ? <FormulaireNouvelEquipement utilisateurs={utilisateurs} /> : undefined}
      />

      {equipements.length === 0 ? (
        <EtatVide
          titre="Aucun équipement"
          message="Ouvrez chaque ordinateur, imprimante, téléphone ou routeur avec son numéro de série et son utilisateur. Garanties, pannes et licences logicielles suivent."
        />
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <CarteIndicateur libelle="Valeur du parc" valeur={fmtCompact(valeur)} unite="FCFA" precision={`${equipements.length} équipements`} />
            <CarteIndicateur libelle="Sous garantie" valeur={fmtEntier(sousGarantie)} precision="Garantie constructeur en cours" />
            <CarteIndicateur libelle="En panne ou à l'atelier" valeur={fmtEntier(enPanne)} ton={enPanne > 0 ? "alerte" : "valide"} precision="Hors service" />
            <CarteIndicateur libelle="Licences en défaut" valeur={fmtEntier(enDefaut)} ton={enDefaut > 0 ? "danger" : "valide"} precision="Expirées ou dépassées" />
          </section>

          <Tableau>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Équipement</Th>
                <Th>Utilisateur</Th>
                <Th>N° de série</Th>
                <Th>Réseau</Th>
                <Th>Garantie</Th>
                <Th>État</Th>
              </tr>
            </thead>
            <tbody>
              {equipements.map((e) => (
                <tr key={e.id}>
                  <Td chiffres>{e.code}</Td>
                  <Td fort>
                    <Link href={`/parc-informatique/${e.id}`} className="hover:underline">
                      {e.designation}
                      <span className={`block text-xs font-normal ${e.fiche ? "text-[var(--encre-douce)]" : "text-alerte-600"}`}>
                        {e.fiche ? [CATEGORIES_EQUIPEMENT[e.fiche.categorie], e.fiche.systeme].filter(Boolean).join(" · ") : "Fiche technique à compléter"}
                      </span>
                    </Link>
                  </Td>
                  <Td>{e.affecteA ?? <span className="text-xs text-[var(--encre-faible)]">Non attribué</span>}</Td>
                  <Td chiffres>{e.fiche?.numeroSerie ?? "—"}</Td>
                  <Td chiffres>
                    {e.fiche?.nomReseau || e.fiche?.adresseIp ? (
                      <span className="text-xs">
                        {e.fiche.nomReseau}
                        {e.fiche.adresseIp && <span className="block text-[var(--encre-faible)]">{e.fiche.adresseIp}</span>}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {e.garantie ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Pastille ton={TON_ECHEANCE[e.garantie.gravite]}>{e.garantie.gravite === "depassee" ? "Échue" : "En cours"}</Pastille>
                        <span className="chiffres text-xs">{libelleEcheance(e.garantie)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--encre-faible)]">—</span>
                    )}
                  </Td>
                  <Td>
                    <Pastille ton={STATUT_ACTIF[e.statut].ton}>{STATUT_ACTIF[e.statut].libelle}</Pastille>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        </>
      )}
    </>
  );
}
