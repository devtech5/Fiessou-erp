import type { Metadata } from "next";
import Link from "next/link";

import { Affluence } from "@/components/boutique/affluence";
import { CatalogueDepart } from "@/components/boutique/catalogue-depart";
import { CarteIndicateur, EnTetePage, EtatVide, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmt, fmtCompact, fmtDateIso, fmtEntier, fmtTauxBp } from "@/lib/format";
import { divideMoney } from "@/lib/money";
import { formaterQuantite } from "@/lib/quantite";
import { heureDePointe, libelleVariation, plageAffluence, variationBp } from "@/modules/boutique/calcul";
import {
  affluenceDuJour,
  chiffresDuJour,
  meilleuresVentes,
  nombreDeFamilles,
  ventesParCaissier,
} from "@/modules/boutique/requetes";
import { alertesReapprovisionnement } from "@/modules/stock/requetes";

export const metadata: Metadata = { title: "Commerce" };

const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Abidjan vit à l'heure UTC : le jour civil se lit directement. */
function decaler(jourIso: string, jours: number): string {
  const d = new Date(`${jourIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function Ecart({ actuel, reference, libelle }: { actuel: number; reference: number; libelle: string }) {
  const bp = variationBp(actuel, reference);
  if (bp === null) return <span>{libelle} : pas de référence</span>;
  return (
    <span>
      <span className={`chiffres font-semibold ${bp > 0 ? "text-valide-600" : bp < 0 ? "text-danger-600" : ""}`}>{libelleVariation(bp)}</span>{" "}
      {libelle}
    </span>
  );
}

/**
 * Tableau de bord du commerce : la journée en chiffres, comparée à la veille et
 * au même jour de la semaine passée — un samedi se compare à un samedi.
 */
export default async function PageBoutique({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const session = await exigerEntreprise();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const demande = (await searchParams).jour;
  const jour = demande && JOUR_ISO.test(demande) && demande <= aujourdhui ? demande : aujourdhui;
  const veille = decaler(jour, -1);
  const semainePassee = decaler(jour, -7);

  const [chiffres, chiffresVeille, chiffresSemaine, heures, top, caissiers, voirStock, gererStock] = await Promise.all([
    chiffresDuJour(session.organizationId, jour),
    chiffresDuJour(session.organizationId, veille),
    chiffresDuJour(session.organizationId, semainePassee),
    affluenceDuJour(session.organizationId, jour),
    meilleuresVentes(session.organizationId, decaler(jour, -6), jour),
    ventesParCaissier(session.organizationId, jour),
    peut("stock.article.consulter"),
    peut("stock.article.gerer"),
  ]);
  const [alertes, familles] = await Promise.all([
    voirStock ? alertesReapprovisionnement(session.organizationId) : Promise.resolve([]),
    gererStock ? nombreDeFamilles(session.organizationId) : Promise.resolve(1),
  ]);

  const plage = plageAffluence(heures);
  const pointe = heureDePointe(heures);
  const ruptures = alertes.filter((a) => a.quantite <= 0).length;
  const tauxMarge = chiffres.ventesHt > 0 ? divideMoney(chiffres.margeBrute * 10_000, chiffres.ventesHt) : null;

  return (
    <>
      <EnTetePage
        titre="Commerce"
        sousTitre={jour === aujourdhui ? `Aujourd'hui, ${fmtDateIso(jour)}` : fmtDateIso(jour)}
        actions={
          <nav className="flex gap-1.5" aria-label="Changer de jour">
            <Link href={`/boutique?jour=${veille}`} className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3 text-sm leading-[var(--h-cible)] hover:bg-[var(--surface-creuse)]">
              ← Veille
            </Link>
            {jour !== aujourdhui && (
              <>
                <Link
                  href={`/boutique?jour=${decaler(jour, 1)}`}
                  className="h-cible rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3 text-sm leading-[var(--h-cible)] hover:bg-[var(--surface-creuse)]"
                >
                  Lendemain →
                </Link>
                <Link href="/boutique" className="h-cible rounded-lg bg-marque-600 px-3 text-sm font-semibold leading-[var(--h-cible)] text-white hover:bg-marque-700">
                  Aujourd&apos;hui
                </Link>
              </>
            )}
          </nav>
        }
      />

      {familles === 0 && <CatalogueDepart />}

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur
          libelle="Chiffre d'affaires"
          valeur={fmtCompact(chiffres.chiffreAffaires)}
          unite="FCFA"
          ton="marque"
          precision={
            <span className="flex flex-col">
              <Ecart actuel={chiffres.chiffreAffaires} reference={chiffresVeille.chiffreAffaires} libelle="sur la veille" />
              <Ecart actuel={chiffres.chiffreAffaires} reference={chiffresSemaine.chiffreAffaires} libelle="sur 7 jours avant" />
            </span>
          }
        />
        <CarteIndicateur
          libelle="Tickets"
          valeur={fmtEntier(chiffres.tickets)}
          precision={
            <span className="flex flex-col">
              <Ecart actuel={chiffres.tickets} reference={chiffresSemaine.tickets} libelle="sur 7 jours avant" />
              {chiffres.annulees > 0 && <span className="text-alerte-600">{chiffres.annulees} annulé{chiffres.annulees > 1 ? "s" : ""}</span>}
            </span>
          }
        />
        <CarteIndicateur
          libelle="Panier moyen"
          valeur={fmt(chiffres.panierMoyen)}
          unite="F"
          precision={<Ecart actuel={chiffres.panierMoyen} reference={chiffresSemaine.panierMoyen} libelle="sur 7 jours avant" />}
        />
        <CarteIndicateur
          libelle="Marge brute"
          valeur={fmtCompact(chiffres.margeBrute)}
          unite="FCFA"
          ton={chiffres.margeBrute < 0 ? "danger" : "neutre"}
          precision={tauxMarge === null ? "Hors taxes, coût de revient déduit" : `${fmtTauxBp(tauxMarge)} des ventes hors taxes`}
        />
      </section>

      <div className="mb-5 grid gap-3 xl:grid-cols-[2fr_1fr]">
        <div>
          <Affluence heures={plage} />
          <p className="mt-1.5 text-xs text-[var(--encre-faible)]">
            {pointe
              ? `Heure de pointe : ${pointe.heure} h – ${pointe.heure + 1} h, ${pointe.tickets} ticket${pointe.tickets > 1 ? "s" : ""}.`
              : "Aucun ticket ce jour-là."}
          </p>
        </div>
        <section className="rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4">
          <h2 className="mb-2 text-sm font-semibold">Par caissier</h2>
          {caissiers.length === 0 ? (
            <p className="text-sm text-[var(--encre-faible)]">Aucune vente.</p>
          ) : (
            <ul className="divide-y divide-[var(--filet)]">
              {caissiers.map((c) => (
                <li key={c.caissier} className="flex items-baseline justify-between gap-2 py-2 text-sm">
                  <span className="truncate">{c.caissier}</span>
                  <span className="chiffres shrink-0 text-[var(--encre-douce)]">
                    {c.tickets} · <strong className="text-[var(--encre)]">{fmt(c.montant)} F</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mb-5">
        <h2 className="mb-2 text-base font-semibold">Meilleures ventes des 7 derniers jours</h2>
        {top.length === 0 ? (
          <EtatVide titre="Aucune vente sur la semaine" message="Les articles vendus en caisse et aux tables apparaissent ici, classés par ce qu'ils ont rapporté." />
        ) : (
          <Tableau>
            <thead>
              <tr>
                <Th>Article</Th>
                <Th aligne="droite">Quantité</Th>
                <Th aligne="droite">Chiffre TTC</Th>
                <Th aligne="droite">Marge</Th>
              </tr>
            </thead>
            <tbody>
              {top.map((a) => (
                <tr key={a.designation}>
                  <Td fort>{a.designation}</Td>
                  <Td aligne="droite" chiffres>
                    {formaterQuantite(a.quantite, a.unite)}
                  </Td>
                  <Td aligne="droite" chiffres>
                    {fmt(a.montant)}
                  </Td>
                  <Td aligne="droite" chiffres>
                    <span className={a.marge < 0 ? "text-danger-600" : ""}>{fmt(a.marge)}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        )}
      </section>

      {voirStock && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">À réapprovisionner</h2>
            {alertes.length > 0 && (
              <Link href="/stock/reapprovisionnement" className="text-sm font-medium text-marque-600 hover:underline">
                Préparer la commande →
              </Link>
            )}
          </div>
          {alertes.length === 0 ? (
            <p className="text-sm text-[var(--encre-faible)]">Aucun article sous son seuil d&apos;alerte.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-[var(--encre-douce)]">
                {alertes.length} article{alertes.length > 1 ? "s" : ""} sous le seuil
                {ruptures > 0 && (
                  <>
                    , dont <strong className="text-danger-600">{ruptures} en rupture</strong>
                  </>
                )}
                .
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {alertes.slice(0, 12).map((a) => (
                  <li
                    key={a.articleId}
                    className={`rounded-full border px-2.5 py-1 text-xs ${a.quantite <= 0 ? "border-danger-600 text-danger-600" : "border-[var(--filet)] text-[var(--encre-douce)]"}`}
                  >
                    {a.designation} · <span className="chiffres">{formaterQuantite(a.quantite, a.unite)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}
