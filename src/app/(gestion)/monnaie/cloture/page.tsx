import type { Metadata } from "next";
import Link from "next/link";

import { EnTetePage, EtatVide, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt } from "@/lib/format";
import { effetSurEspeces } from "@/modules/monnaie/calcul";
import { guichetOuvert, historiqueSessions, type SessionVue } from "@/modules/monnaie/requetes";

import { Rapprochement } from "./rapprochement";

export const metadata: Metadata = { title: "Clôture du guichet" };

const MOMENT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** Compte rendu de la dernière clôture : ce que l'agent doit retenir en rendant son tiroir. */
function DerniereCloture({ session }: { session: SessionVue }) {
  const ecart = session.ecartEspeces ?? 0;
  const ton =
    ecart === 0
      ? { cadre: "border-valide-500 bg-valide-50", texte: "text-valide-600", verdict: "Caisse juste" }
      : ecart < 0
        ? { cadre: "border-danger-500 bg-danger-50", texte: "text-danger-600", verdict: `Manquant de ${fmt(-ecart)} F` }
        : { cadre: "border-alerte-500 bg-alerte-50", texte: "text-alerte-600", verdict: `Excédent de ${fmt(ecart)} F` };

  return (
    <section role="status" className={`rounded-xl border-l-4 px-4 py-4 ${ton.cadre}`}>
      <p className={`text-sm font-semibold ${ton.texte}`}>
        Session {session.numero} clôturée — {ton.verdict}
      </p>
      <p className="mt-0.5 text-sm text-[var(--encre-douce)]">
        {session.clotureeLe ? `Le ${HEURE.format(session.clotureeLe)}. ` : ""}
        {session.ecriture
          ? `Écriture ${session.ecriture} passée au journal de caisse.`
          : "Aucune écriture : ni opération, ni commission, ni écart à comptabiliser."}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-[var(--encre-faible)]">Opérations</dt>
          <dd className="chiffres font-semibold">{session.operations}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--encre-faible)]">Espèces comptées</dt>
          <dd className="chiffres font-semibold">{session.especesComptees === null ? "—" : `${fmt(session.especesComptees)} F`}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--encre-faible)]">Écart</dt>
          <dd className={`chiffres font-semibold ${ton.texte}`}>
            {ecart === 0 ? "0" : `${ecart > 0 ? "+" : "−"} ${fmt(Math.abs(ecart))}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--encre-faible)]">Commissions dues</dt>
          <dd className="chiffres font-semibold">{fmt(session.commissions)} F</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-[var(--encre-faible)]">
        Le guichet est fermé. La prochaine ouverture reprend ces montants comme base.{" "}
        <Link href="/monnaie" className="font-semibold text-marque-600 hover:underline">
          Ouvrir une nouvelle session
        </Link>
      </p>
    </section>
  );
}

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
      ) : historique[0] ? (
        // Le compte rendu de la dernière clôture reste affiché tant qu'aucune
        // session n'est rouverte : le formulaire qui portait le message de
        // confirmation disparaît avec la session qu'il a fermée.
        <DerniereCloture session={historique[0]} />
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
