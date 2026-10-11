import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FormulaireAcompte,
  FormulaireDates,
  FormulairePrestation,
  FormulaireVoyageur,
  PanneauAnnulation,
  PanneauArrivee,
  PanneauDepart,
  RetirerPrestation,
} from "@/components/hotel/panneau-sejour";
import { CarteIndicateur, EnTetePage, EtatVide, Pastille, Tableau, Td, Th, type TonPastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtPeriode } from "@/lib/format";
import { derniereNuit, nuitsEntre } from "@/modules/hotellerie/calcul";
import { aujourdHuiPour } from "@/modules/hotellerie/creation";
import { ficheSejour } from "@/modules/hotellerie/requetes";
import { joursEntre } from "@/modules/reservations/calcul";
import type { StatutContrat } from "@/modules/reservations/schema";

export const metadata: Metadata = { title: "Séjour" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUT: Record<StatutContrat, { libelle: string; ton: TonPastille }> = {
  reserve: { libelle: "Réservé", ton: "neutre" },
  en_cours: { libelle: "Présent", ton: "marque" },
  restitue: { libelle: "Parti", ton: "valide" },
  annule: { libelle: "Annulé", ton: "neutre" },
};
const BASE: Record<string, string> = { jour: "à la nuit", semaine: "forfait semaine", mois: "forfait mois", negocie: "tarif négocié" };
const COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const court = (iso: string) => COURT.format(new Date(`${iso}T12:00:00Z`));
const MOYEN: Record<string, string> = { especes: "Espèces", mobile_money: "Mobile money", banque: "Banque" };

export default async function PageSejour({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const session = await exigerEntreprise();
  const [s, gerer, jour] = await Promise.all([ficheSejour(session.organizationId, id), peut("hotellerie.sejour.gerer"), aujourdHuiPour(session.organizationId)]);
  if (!s) notFound();

  const ouvert = s.statut === "reserve" || s.statut === "en_cours";
  const nuits = nuitsEntre(s.arrivee, s.depart);
  const statut = s.statut === "reserve" && s.arrivee < jour ? { libelle: "Non arrivé", ton: "alerte" as TonPastille } : STATUT[s.statut];

  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/hotel/sejours" className="text-[var(--encre-douce)] hover:underline">
          ← Tous les séjours
        </Link>
      </p>
      <EnTetePage
        titre={`${s.numero} · chambre ${s.chambre.code}`}
        sousTitre={`${s.client.nom}${s.client.telephone ? ` · ${s.client.telephone}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Pastille ton={statut.ton}>{statut.libelle}</Pastille>
            {s.statut !== "annule" && (
              <Link href={`/imprimer/note-chambre/${s.id}`} className="h-cible inline-flex items-center rounded-lg border border-[var(--filet)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]">
                {s.statut === "restitue" ? "Facture" : "Note provisoire"}
              </Link>
            )}
          </div>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Séjour"
          valeur={`${nuits} nuit${nuits > 1 ? "s" : ""}`}
          precision={`${fmtPeriode(s.arrivee, s.depart)} · ${s.adultes + s.enfants} pers.`}
        />
        <CarteIndicateur libelle="Hébergement" valeur={fmt(s.hebergement)} unite="F" precision={BASE[s.baseTarif] ?? s.baseTarif} />
        <CarteIndicateur libelle="Note" valeur={fmt(s.note.total)} unite="F" precision={`Dont ${fmt(s.note.total - s.hebergement)} F de consommations`} />
        <CarteIndicateur
          libelle={
            s.statut === "restitue"
              ? s.note.reste < 0 ? "Rendu au départ" : "Réglé au départ"
              : s.note.reste < 0 ? "À rendre" : "Reste dû"
          }
          valeur={fmt(Math.abs(s.note.reste))}
          unite="F"
          ton={!ouvert ? "valide" : s.note.reste > 0 ? "alerte" : "valide"}
          precision={s.note.verse > 0 ? `${fmt(s.note.verse)} F d'acomptes` : "Aucun acompte"}
        />
      </section>

      {s.motif && <p className="mb-4 text-sm text-[var(--encre-douce)]">Annulé : {s.motif}</p>}
      {s.notes && <p className="mb-4 text-sm text-[var(--encre-douce)]">Note : {s.notes}</p>}

      {gerer && ouvert && (
        <div className="mb-6 grid gap-3">
          {s.statut === "reserve" && <PanneauArrivee sejourId={s.id} caution={s.caution} voyageurs={s.voyageurs.length} />}
          {s.statut === "en_cours" && (
            <PanneauDepart
              sejourId={s.id}
              reste={s.note.reste}
              caution={s.caution}
              aUnCompte={s.client.aUnCompte}
              departPrevu={s.depart}
              nuitsPrevues={nuits}
              nuitsAujourdhui={joursEntre(s.arrivee, derniereNuit(s.arrivee, jour))}
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {s.statut === "en_cours" && <FormulairePrestation sejourId={s.id} />}
            <FormulaireAcompte sejourId={s.id} />
            <FormulaireDates sejourId={s.id} arrivee={s.arrivee} depart={s.depart} arrive={s.statut === "en_cours"} />
            {s.statut === "reserve" && <PanneauAnnulation sejourId={s.id} acomptes={s.note.verse} />}
          </div>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold">Note de chambre</h2>
      <Tableau>
        <thead>
          <tr>
            <Th>Jour</Th>
            <Th>Désignation</Th>
            <Th aligne="droite">Qté</Th>
            <Th aligne="droite">Prix</Th>
            <Th aligne="droite">Montant</Th>
            {gerer && s.statut === "en_cours" && <Th aligne="droite">{""}</Th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td chiffres>{court(s.arrivee)}</Td>
            <Td fort>
              Hébergement, chambre {s.chambre.code}
              <span className="block text-xs font-normal text-[var(--encre-faible)]">
                {nuits} nuit{nuits > 1 ? "s" : ""}, {BASE[s.baseTarif] ?? s.baseTarif}
              </span>
            </Td>
            <Td aligne="droite" chiffres>{nuits}</Td>
            <Td aligne="droite" chiffres>{s.prixNuit !== null ? fmt(s.prixNuit) : "—"}</Td>
            <Td aligne="droite" chiffres fort>{fmt(s.hebergement)}</Td>
            {gerer && s.statut === "en_cours" && <Td>{""}</Td>}
          </tr>
          {s.prestations.map((p) => (
            <tr key={p.id}>
              <Td chiffres>{court(p.jour)}</Td>
              <Td>{p.libelle}</Td>
              <Td aligne="droite" chiffres>{p.quantite}</Td>
              <Td aligne="droite" chiffres>{fmt(p.prixUnitaire)}</Td>
              <Td aligne="droite" chiffres>{fmt(p.montant)}</Td>
              {gerer && s.statut === "en_cours" && (
                <Td aligne="droite">
                  <RetirerPrestation id={p.id} />
                </Td>
              )}
            </tr>
          ))}
          {s.acomptes.map((a) => (
            <tr key={a.id}>
              <Td chiffres>{court(a.jour)}</Td>
              <Td>
                Acompte {a.numero}
                <span className="block text-xs text-[var(--encre-faible)]">{MOYEN[a.moyen] ?? a.moyen}</span>
              </Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
              <Td aligne="droite" chiffres>− {fmt(a.montant)}</Td>
              {gerer && s.statut === "en_cours" && <Td>{""}</Td>}
            </tr>
          ))}
        </tbody>
      </Tableau>

      <div className="mt-6 mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Fiche de police</h2>
        {gerer && ouvert && <FormulaireVoyageur sejourId={s.id} premier={s.voyageurs.length === 0} />}
      </div>
      {s.voyageurs.length === 0 ? (
        <EtatVide titre="Aucun voyageur enregistré" message="La fiche de police se remplit avant l'arrivée : identité, nationalité, pièce d'identité, provenance et destination." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Voyageur</Th>
              <Th>Nationalité</Th>
              <Th>Pièce</Th>
              <Th>Venant de · allant à</Th>
            </tr>
          </thead>
          <tbody>
            {s.voyageurs.map((v) => (
              <tr key={v.id}>
                <Td fort>
                  {v.nom} {v.prenoms}
                  {v.profession && <span className="block text-xs font-normal text-[var(--encre-faible)]">{v.profession}</span>}
                </Td>
                <Td>{v.nationalite}</Td>
                <Td chiffres>
                  {v.pieceNature} {v.pieceNumero}
                </Td>
                <Td>{[v.provenance, v.destination].filter(Boolean).join(" → ") || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      {s.ecritures.length > 0 && (
        <p className="mt-4 text-xs text-[var(--encre-faible)]">
          Écritures : <span className="chiffres">{s.ecritures.join(", ")}</span>
        </p>
      )}
    </>
  );
}
