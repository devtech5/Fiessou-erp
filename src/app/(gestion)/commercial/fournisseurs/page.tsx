import type { Metadata } from "next";

import { BoutonDemonstration } from "@/components/bouton-demonstration";
import {
  CarteIndicateur,
  EnTetePage,
  EtatVide,
  Tableau,
  Td,
  Th,
} from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmt, fmtCompact, fmtEntier, fmtTaux } from "@/lib/format";
import { fichesTiers } from "@/modules/tiers/requetes";
import { FormulaireTiers } from "../formulaire-tiers";

export const metadata: Metadata = { title: "Fournisseurs" };

export default async function PageFournisseurs() {
  const session = await exigerEntreprise();
  const fournisseurs = await fichesTiers(session.organizationId, "fournisseur");

  const volume = fournisseurs.reduce((somme, f) => somme + f.achatsFournisseur, 0);
  const du = fournisseurs.reduce((somme, f) => somme + f.duFournisseur, 0);

  // Moyenne sur les seuls fournisseurs dont le délai est renseigné : compter
  // les zéros comme des livraisons instantanées rendrait la moyenne flatteuse
  // et le réapprovisionnement trop tardif.
  const avecDelai = fournisseurs.filter((f) => f.delaiLivraisonJours > 0);
  const delaiMoyen =
    avecDelai.length === 0
      ? null
      : avecDelai.reduce((somme, f) => somme + f.delaiLivraisonJours, 0) /
        avecDelai.length;

  return (
    <>
      <EnTetePage
        titre="Fournisseurs"
        sousTitre={
          fournisseurs.length === 0
            ? "Aucun fournisseur référencé"
            : `${fournisseurs.length} fournisseurs référencés`
        }
        actions={<FormulaireTiers role="fournisseur" />}
      />

      {fournisseurs.length === 0 ? (
        <EtatVide
          titre="Aucun fournisseur"
          message="Le délai de livraison saisi ici alimente le réapprovisionnement : sans lui, la quantité suggérée arrive après la rupture."
          actions={<BoutonDemonstration libelle="Installer le fichier de démonstration" />}
        />
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-3">
            <CarteIndicateur
              libelle="Volume d'achats"
              valeur={fmtCompact(volume)}
              unite="FCFA"
              precision="Déduit des écritures d'achat"
            />
            <CarteIndicateur
              libelle="Solde dû"
              valeur={fmtCompact(du)}
              unite="FCFA"
              ton={du > 0 ? "alerte" : "valide"}
              precision="Lignes 401 non lettrées"
            />
            <CarteIndicateur
              libelle="Délai moyen"
              valeur={delaiMoyen === null ? "—" : fmtTaux(delaiMoyen)}
              unite={delaiMoyen === null ? undefined : "jours"}
              precision={
                delaiMoyen === null
                  ? "Aucun délai renseigné"
                  : "Sert au calcul du réapprovisionnement"
              }
            />
          </section>

          <Tableau>
            <thead>
              <tr>
                <Th>Référence</Th>
                <Th>Fournisseur</Th>
                <Th>Secteur</Th>
                <Th>Téléphone</Th>
                <Th aligne="droite">Délai</Th>
                <Th aligne="droite">Achats</Th>
                <Th aligne="droite">Solde dû</Th>
              </tr>
            </thead>
            <tbody>
              {fournisseurs.map((fournisseur) => (
                <tr key={fournisseur.id}>
                  <Td chiffres>{fournisseur.code}</Td>
                  <Td fort>
                    {fournisseur.nom}
                    {fournisseur.identifiantFiscal && (
                      <span className="chiffres block text-xs font-normal text-[var(--encre-faible)]">
                        {fournisseur.identifiantFiscal}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--encre-douce)]">
                      {fournisseur.secteur ?? "—"}
                    </span>
                  </Td>
                  <Td chiffres>{fournisseur.telephone ?? "—"}</Td>
                  <Td aligne="droite" chiffres>
                    {fournisseur.delaiLivraisonJours > 0
                      ? `${fmtEntier(fournisseur.delaiLivraisonJours)} j`
                      : "—"}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {fmt(fournisseur.achatsFournisseur)}
                  </Td>
                  <Td aligne="droite" chiffres fort>
                    <span className={fournisseur.duFournisseur > 0 ? "text-alerte-600" : ""}>
                      {fmt(fournisseur.duFournisseur)}
                    </span>
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
