import type { Metadata } from "next";

import { EnTetePage, EtatVide, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt } from "@/lib/format";
import { effetSurEspeces } from "@/modules/monnaie/calcul";
import { guichetOuvert, historiqueSessions } from "@/modules/monnaie/requetes";

import { Rapprochement } from "./rapprochement";

export const metadata: Metadata = { title: "Clôture du guichet" };

const MOMENT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function PageCloture() {
  const session = await exigerEntreprise();
  const [guichet, historique, cloturer] = await Promise.all([
    guichetOuvert(session.organizationId),
    historiqueSessions(session.organizationId),
    peut("valeur_electronique.session.cloturer"),
  ]);

  const effets = (guichet?.operations ?? [])
    .filter((o) => !o.annulee)
    .map((o) => effetSurEspeces(o.type, o.montant));

  return (
    <>
      <EnTetePage
        titre="Clôture du guichet"
        sousTitre={guichet ? `Rapprochement de la session ${guichet.session.numero}` : "Rapprochement des espèces et du float"}
      />

      {guichet ? (
        <Rapprochement
          soldes={guichet.soldes}
          fondCaisse={guichet.session.fondCaisse}
          ouvertures={guichet.ouvertures}
          volumes={{
            entrees: effets.filter((e) => e > 0).reduce((s, e) => s + e, 0),
            sorties: Math.abs(effets.filter((e) => e < 0).reduce((s, e) => s + e, 0)),
          }}
          autorise={cloturer}
        />
      ) : (
        <EtatVide titre="Aucune session ouverte" message="La clôture rapproche la session en cours. Ouvrez le guichet pour commencer." />
      )}

      {historique.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-[var(--encre-douce)]">Clôtures précédentes</h2>
          <Tableau>
            <thead>
              <tr>
                <Th>Session</Th>
                <Th>Ouverte</Th>
                <Th>Clôturée</Th>
                <Th aligne="droite">Opérations</Th>
                <Th aligne="droite">Commissions</Th>
                <Th aligne="droite">Espèces comptées</Th>
                <Th aligne="droite">Écart</Th>
                <Th>Écritures</Th>
              </tr>
            </thead>
            <tbody>
              {historique.map((s) => (
                <tr key={s.id}>
                  <Td chiffres fort>{s.numero}</Td>
                  <Td chiffres>{MOMENT.format(s.ouverteLe)}</Td>
                  <Td chiffres>{s.clotureeLe ? MOMENT.format(s.clotureeLe) : "—"}</Td>
                  <Td aligne="droite" chiffres>{s.operations}</Td>
                  <Td aligne="droite" chiffres>{fmt(s.commissions)}</Td>
                  <Td aligne="droite" chiffres>{s.especesComptees === null ? "—" : fmt(s.especesComptees)}</Td>
                  <Td aligne="droite" chiffres fort>
                    <span
                      className={
                        s.ecartEspeces === 0 ? "text-valide-600" : (s.ecartEspeces ?? 0) < 0 ? "text-danger-600" : "text-alerte-600"
                      }
                    >
                      {s.ecartEspeces === null ? "—" : s.ecartEspeces === 0 ? "0" : `${s.ecartEspeces > 0 ? "+" : "−"} ${fmt(Math.abs(s.ecartEspeces))}`}
                    </span>
                  </Td>
                  <Td chiffres>
                    {s.ecriture ?? "—"}
                    {s.ecritureOuverture && (
                      <span className="block text-xs text-[var(--encre-faible)]">ouverture {s.ecritureOuverture}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        </section>
      )}
    </>
  );
}
