import type { Metadata } from "next";

import {
  BoutonSecondaire,
  CarteIndicateur,
  EnTetePage,
  Pastille,
  Tableau,
  Td,
  Th,
  type TonPastille,
} from "@/components/ui/primitives";
import { fmt, fmtEntier } from "@/lib/format";
import {
  BILLETS,
  LIBELLE_BILLET,
  type StatutBillet,
} from "@/lib/fixtures/billetterie";

export const metadata: Metadata = { title: "Billets" };

const TON: Record<StatutBillet, TonPastille> = {
  valide: "marque",
  embarque: "valide",
  annule: "neutre",
  non_presente: "danger",
};

/**
 * Billets émis et contrôle à l'embarquement.
 *
 * Le billet est nominatif et porte son siège : c'est ce couple qui se contrôle
 * à la montée. Un billet « non présenté » libère une place que le contrôleur
 * peut revendre sur place, mais seulement après le départ annoncé — sinon on
 * vend le siège d'un passager en retard qui arrive.
 */
export default function PageBillets() {
  const valides = BILLETS.filter((b) => b.statut === "valide");
  const embarques = BILLETS.filter((b) => b.statut === "embarque");
  const absents = BILLETS.filter((b) => b.statut === "non_presente");
  const enLigne = BILLETS.filter((b) => b.canal === "en_ligne");

  const recette = BILLETS.filter((b) => b.statut !== "annule").reduce(
    (s, b) => s + b.montant,
    0,
  );

  return (
    <>
      <EnTetePage
        titre="Billets"
        sousTitre="Émission et contrôle à l'embarquement"
        actions={<BoutonSecondaire>Scanner un billet</BoutonSecondaire>}
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Billets émis"
          valeur={fmtEntier(BILLETS.length)}
          precision={`${fmt(recette)} FCFA encaissés`}
        />
        <CarteIndicateur
          libelle="À embarquer"
          valeur={fmtEntier(valides.length)}
          ton="marque"
          precision="Départs à venir"
        />
        <CarteIndicateur
          libelle="Non présentés"
          valeur={fmtEntier(absents.length)}
          ton={absents.length > 0 ? "danger" : "valide"}
          precision="Places perdues au départ"
        />
        <CarteIndicateur
          libelle="Vendus en ligne"
          valeur={`${Math.round((enLigne.length / BILLETS.length) * 100)}`}
          unite="%"
          precision={`${enLigne.length} sur ${BILLETS.length} billets`}
        />
      </section>

      <Tableau>
        <thead>
          <tr>
            <Th>Numéro</Th>
            <Th>Passager</Th>
            <Th>Trajet</Th>
            <Th aligne="droite">Siège</Th>
            <Th>Pièce</Th>
            <Th>Canal</Th>
            <Th>Statut</Th>
            <Th aligne="droite">Montant</Th>
          </tr>
        </thead>
        <tbody>
          {BILLETS.map((billet) => (
            <tr key={billet.id}>
              <Td chiffres fort>
                {billet.numero}
              </Td>
              <Td>
                {billet.passager}
                <span className="chiffres block text-xs text-[var(--encre-faible)]">
                  {billet.telephone}
                </span>
              </Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">
                  {billet.ligne}
                </span>
                <span className="chiffres block text-xs text-[var(--encre-faible)]">
                  {billet.depart}
                </span>
              </Td>
              <Td aligne="droite" chiffres fort>
                {billet.siege}
              </Td>
              <Td chiffres>
                {/* Sans pièce relevée à la vente, le contrôle ne peut pas
                    vérifier que le porteur est bien le titulaire. */}
                {billet.piece ?? (
                  <span className="text-xs text-[var(--encre-faible)]">
                    Non relevée
                  </span>
                )}
              </Td>
              <Td>
                <span className="text-xs text-[var(--encre-douce)]">
                  {billet.canal === "en_ligne" ? "En ligne" : "Guichet"}
                </span>
              </Td>
              <Td>
                <Pastille ton={TON[billet.statut]}>
                  {LIBELLE_BILLET[billet.statut]}
                </Pastille>
              </Td>
              <Td aligne="droite" chiffres fort>
                {billet.statut === "annule" ? (
                  <span className="text-[var(--encre-faible)] line-through">
                    {fmt(billet.montant)}
                  </span>
                ) : (
                  fmt(billet.montant)
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </>
  );
}
