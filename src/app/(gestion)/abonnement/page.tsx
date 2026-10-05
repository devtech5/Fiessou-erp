import type { Metadata } from "next";

import { CarteIndicateur, EnTetePage, Pastille, Tableau, Td, Th, type TonPastille } from "@/components/ui/primitives";
import { env } from "@/env";
import { FORMULES, formule, type Phase } from "@/lib/abonnement/calcul";
import { abonnementCourant } from "@/lib/abonnement/garde";
import { paiementsDe } from "@/lib/abonnement/requetes";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmt } from "@/lib/format";

export const metadata: Metadata = { title: "Abonnement" };

const date = (v: string | null) => (v ? v.slice(0, 10).split("-").reverse().join("/") : "—");

const PHASE: Record<Phase, { libelle: string; ton: TonPastille }> = {
  essai: { libelle: "Essai gratuit", ton: "marque" },
  actif: { libelle: "Actif", ton: "valide" },
  grace: { libelle: "Échu — période de grâce", ton: "alerte" },
  expire: { libelle: "Échu — lecture seule", ton: "danger" },
  suspendu: { libelle: "Suspendu", ton: "danger" },
  resilie: { libelle: "Résilié", ton: "neutre" },
};

const MOYEN: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_money: "MTN Mobile Money",
  moov_money: "Moov Money",
  virement: "Virement",
  especes: "Espèces",
  autre: "Autre",
};

/**
 * Abonnement de l'entreprise : où il en est, comment payer, ce qui a été
 * payé. Ouvert à tous les membres, sans droit particulier : en lecture
 * seule, c'est justement la page qu'il faut encore pouvoir atteindre.
 */
export default async function PageAbonnement() {
  const session = await exigerEntreprise();
  const [etat, paiements] = await Promise.all([abonnementCourant(), paiementsDe(session.organizationId)]);
  const phase = etat ? PHASE[etat.phase] : PHASE.essai;
  const actuelle = formule(paiements[0]?.plan ?? null);

  return (
    <>
      <EnTetePage titre="Abonnement" sousTitre={session.organizationNom ?? undefined} />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2">
        <CarteIndicateur libelle="État" valeur={phase.libelle} ton={phase.ton === "danger" ? "danger" : phase.ton === "alerte" ? "alerte" : "valide"} precision={etat?.message ?? "Tout est en ordre"} />
        <CarteIndicateur
          libelle={etat?.phase === "essai" ? "Fin de l'essai" : "Couvert jusqu'au"}
          valeur={date(etat?.finLe ?? null)}
          precision={etat?.jours != null ? (etat.jours >= 0 ? `${etat.jours} jour${etat.jours > 1 ? "s" : ""} restant${etat.jours > 1 ? "s" : ""}` : `Échu depuis ${-etat.jours} jour${-etat.jours > 1 ? "s" : ""}`) : undefined}
        />
        <CarteIndicateur libelle="Formule" valeur={actuelle?.nom ?? "—"} precision={actuelle?.resume ?? "Aucune formule souscrite"} />
      </section>

      <h2 className="mb-2 text-sm font-semibold">Formules</h2>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {FORMULES.map((f) => (
          <article key={f.cle} className={`rounded-xl border bg-[var(--surface)] p-4 ${actuelle?.cle === f.cle ? "border-marque-500" : "border-[var(--filet)]"}`}>
            <header className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{f.nom}</h3>
              {actuelle?.cle === f.cle && <Pastille ton="marque">Votre formule</Pastille>}
            </header>
            <p className="text-sm text-[var(--encre-douce)]">{f.resume}</p>
            <p className="my-3 text-lg font-bold">{f.prixMensuel ? `${fmt(f.prixMensuel)} F / mois` : "Tarif sur demande"}</p>
            <ul className="space-y-1 text-sm">
              {f.inclus.map((i) => (
                <li key={i}>· {i}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold">Comment payer</h2>
      <p className="mb-6 max-w-[70ch] whitespace-pre-line rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 text-sm">
        {env.ABONNEMENT_PAIEMENT ||
          "Contactez Fiessou pour régler votre abonnement. Dès réception du paiement, la période couverte s'affiche ici et l'accès complet est rétabli."}
      </p>

      <h2 className="mb-2 text-sm font-semibold">Paiements reçus</h2>
      {paiements.length === 0 ? (
        <p className="text-sm text-[var(--encre-faible)]">Aucun paiement enregistré.</p>
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Reçu le</Th>
              <Th>Formule</Th>
              <Th>Moyen</Th>
              <Th>Période couverte</Th>
              <Th aligne="droite">Montant</Th>
            </tr>
          </thead>
          <tbody>
            {paiements.map((p) => (
              <tr key={p.id}>
                <Td chiffres>{date(p.recuLe)}</Td>
                <Td>{formule(p.plan)?.nom ?? p.plan}</Td>
                <Td>
                  {MOYEN[p.moyen] ?? p.moyen}
                  {p.reference && <span className="block text-xs text-[var(--encre-faible)]">{p.reference}</span>}
                </Td>
                <Td chiffres>
                  {p.mois > 0 ? `${date(p.couvreDu)} → ${date(p.couvreAu)}` : `Correction : ${p.mois} mois`}
                </Td>
                <Td aligne="droite" chiffres fort>
                  {fmt(p.montant)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  );
}
