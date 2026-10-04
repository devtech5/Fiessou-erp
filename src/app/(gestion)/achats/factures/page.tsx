import type { Metadata } from "next";

import { EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { articlesAchetables, fournisseursActifs, listerFactures } from "@/modules/achats/requetes";

import { EditeurFacture } from "../editeur-facture";
import { ListeFactures } from "./liste";

export const metadata: Metadata = { title: "Factures fournisseurs" };

/**
 * Factures fournisseurs : celles des commandes, et celles des frais généraux
 * — électricité, loyer, honoraires — saisies directement ici.
 */
export default async function PageFacturesFournisseur() {
  const session = await exigerEntreprise();
  const saisir = await peut("achats.facture.saisir");
  const [factures, fournisseurs, articles] = await Promise.all([
    listerFactures(session.organizationId),
    saisir ? fournisseursActifs(session.organizationId) : Promise.resolve([]),
    saisir ? articlesAchetables(session.organizationId) : Promise.resolve([]),
  ]);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <>
      <EnTetePage
        titre="Factures fournisseurs"
        sousTitre="Chaque facture passe son écriture d'achat et inscrit la dette au compte du fournisseur"
        actions={
          saisir && fournisseurs.length > 0 ? (
            <EditeurFacture fournisseurs={fournisseurs} articles={articles} aujourdhui={aujourdhui} libelleBouton="Facture sans commande" />
          ) : undefined
        }
      />
      {factures.length === 0 ? (
        <EtatVide
          titre="Aucune facture fournisseur"
          message="Saisissez la facture depuis sa commande pour la contrôler face à la réception, ou directement ici pour les frais généraux : électricité, loyer, transport, honoraires."
        />
      ) : (
        <ListeFactures factures={factures} annuler={saisir} aujourdhui={aujourdhui} />
      )}
    </>
  );
}
