import type { Metadata } from "next";
import Link from "next/link";

import { AccesRefuse } from "@/components/coque/acces-refuse";
import { CLASSE_CHAMP, EnTetePage, EtatVide, Pastille, Tableau, Td, Th, type TonPastille } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtEntier } from "@/lib/format";
import { appareil, CATEGORIES, categorieAction, libelleAction, moduleAction, resumeDetail, type Categorie } from "@/lib/journal";
import { acteursJournal, lireJournal, PAR_PAGE, presences } from "@/lib/journal-requetes";

import { adresse, lireFiltres } from "./filtres";

export const metadata: Metadata = { title: "Journal d'activité" };

const MOMENT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Africa/Abidjan",
});

const TON: Record<Categorie, TonPastille> = {
  connexion: "neutre",
  creation: "valide",
  modification: "marque",
  affectation: "alerte",
  suppression: "danger",
  consultation: "neutre",
};

/**
 * Journal d'activité.
 *
 * Qui s'est connecté, déconnecté, qui a créé, modifié, attribué ou supprimé
 * quoi, quand, et depuis quel appareil. Lecture seule : le journal ne
 * s'efface pas, même par le propriétaire.
 */
export default async function PageJournal({ searchParams }: PageProps<"/journal">) {
  const session = await exigerEntreprise();
  if (!(await peut("organisation.journal.consulter"))) return <AccesRefuse droit="organisation.journal.consulter" />;

  const filtres = lireFiltres(await searchParams);
  const [{ lignes, total, parCategorie }, personnes, presence] = await Promise.all([
    lireJournal(session.organizationId, filtres, filtres.page),
    acteursJournal(session.organizationId),
    presences(session.organizationId),
  ]);

  const noms = new Map(personnes.map((p) => [p.userId, p.nom]));
  for (const p of presence) noms.set(p.userId, p.nom);
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const libelleChamp = "mb-1 block text-xs font-semibold text-[var(--encre-faible)]";
  const filtre = (actif: boolean) =>
    `shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
      actif ? "bg-marque-600 text-white" : "bg-[var(--surface-creuse)] text-[var(--encre-douce)] hover:bg-[var(--filet)]"
    }`;

  return (
    <>
      <EnTetePage
        titre="Journal d'activité"
        sousTitre="Connexions, créations, modifications, affectations et suppressions — qui, quoi, quand, depuis où"
        actions={
          <a
            href={adresse("/journal/export", filtres, { page: null })}
            className="h-cible inline-flex items-center rounded-lg border border-[var(--filet)] bg-[var(--surface)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]"
          >
            Exporter en CSV
          </a>
        }
      />

      <form method="get" action="/journal" className="mb-4 grid gap-3 rounded-xl border border-[var(--filet)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
        {filtres.categorie && <input type="hidden" name="categorie" value={filtres.categorie} />}
        <label className="block">
          <span className={libelleChamp}>Rechercher</span>
          <input name="q" defaultValue={filtres.recherche ?? ""} placeholder="Numéro, nom, geste…" className={CLASSE_CHAMP} />
        </label>
        <label className="block">
          <span className={libelleChamp}>Personne</span>
          <select name="membre" defaultValue={filtres.membre ?? ""} className={CLASSE_CHAMP}>
            <option value="">Tout le monde</option>
            {personnes.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={libelleChamp}>Du</span>
          <input type="date" name="du" defaultValue={filtres.du ?? ""} className={CLASSE_CHAMP} />
        </label>
        <label className="block">
          <span className={libelleChamp}>Au</span>
          <input type="date" name="au" defaultValue={filtres.au ?? ""} className={CLASSE_CHAMP} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-cible rounded-lg bg-marque-500 px-4 text-sm font-semibold text-white hover:bg-marque-600">
            Filtrer
          </button>
          <Link href="/journal" className="h-cible inline-flex items-center rounded-lg px-3 text-sm text-[var(--encre-faible)] hover:underline">
            Effacer
          </Link>
        </div>
      </form>

      <nav aria-label="Familles de gestes" className="mb-4 flex gap-1.5 overflow-x-auto pb-0.5">
        <Link href={adresse("/journal", filtres, { categorie: null, page: null })} className={filtre(!filtres.categorie)}>
          Tout ({fmtEntier(Object.values(parCategorie).reduce((s, n) => s + n, 0))})
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.cle}
            href={adresse("/journal", filtres, { categorie: c.cle, page: null })}
            aria-current={filtres.categorie === c.cle ? "page" : undefined}
            className={filtre(filtres.categorie === c.cle)}
          >
            {c.libelle} ({fmtEntier(parCategorie[c.cle])})
          </Link>
        ))}
      </nav>

      {lignes.length === 0 ? (
        <EtatVide titre="Aucun geste" message="Aucune ligne du journal ne correspond à ces filtres." />
      ) : (
        <>
          <Tableau>
            <thead>
              <tr>
                <Th>Quand</Th>
                <Th>Qui</Th>
                <Th>Geste</Th>
                <Th>Détail</Th>
                <Th>Depuis</Th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const categorie = categorieAction(l.action);
                const avant = resumeDetail(l.avant, noms);
                const apres = resumeDetail(l.apres, noms);
                return (
                  <tr key={l.id} className={l.action === "connexion.refusee" ? "bg-danger-50/40" : undefined}>
                    <Td chiffres>{MOMENT.format(l.le)}</Td>
                    <Td fort>{l.acteur}</Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Pastille ton={TON[categorie]}>{moduleAction(l.action)}</Pastille>
                        <span className={l.action === "connexion.refusee" ? "font-semibold text-danger-600" : ""}>{libelleAction(l.action)}</span>
                      </span>
                    </Td>
                    <Td>
                      <span className="block max-w-[420px] text-xs text-[var(--encre-douce)]">
                        {avant && <span className="block text-[var(--encre-faible)]">avant : {avant}</span>}
                        {apres || (avant ? "" : "—")}
                      </span>
                    </Td>
                    <Td>
                      <span className="block whitespace-nowrap text-xs">
                        {appareil(l.userAgent)}
                        {l.ipAddress && <span className="chiffres block text-[var(--encre-faible)]">{l.ipAddress}</span>}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tableau>

          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--encre-faible)]">
              {fmtEntier(total)} geste{total > 1 ? "s" : ""} · page {filtres.page} sur {pages}
            </span>
            <span className="flex gap-2">
              {filtres.page > 1 && (
                <Link href={adresse("/journal", filtres, { page: String(filtres.page - 1) })} className="rounded-lg border border-[var(--filet)] px-3 py-1.5 hover:bg-[var(--surface-creuse)]">
                  ← Plus récents
                </Link>
              )}
              {filtres.page < pages && (
                <Link href={adresse("/journal", filtres, { page: String(filtres.page + 1) })} className="rounded-lg border border-[var(--filet)] px-3 py-1.5 hover:bg-[var(--surface-creuse)]">
                  Plus anciens →
                </Link>
              )}
            </span>
          </div>
        </>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-[var(--encre-douce)]">Présence des membres</h2>
        <Tableau>
          <thead>
            <tr>
              <Th>Membre</Th>
              <Th>Dernière connexion</Th>
              <Th>Dernière déconnexion</Th>
              <Th aligne="droite">Échecs de connexion (7 j)</Th>
              <Th aligne="droite">Gestes (7 j)</Th>
            </tr>
          </thead>
          <tbody>
            {presence.map((p) => (
              <tr key={p.userId}>
                <Td fort>
                  <Link href={adresse("/journal", { page: 1 }, { membre: p.userId })} className="hover:underline">
                    {p.nom}
                  </Link>
                </Td>
                <Td chiffres>{p.derniereConnexion ? MOMENT.format(p.derniereConnexion) : "Jamais depuis l'ouverture du journal"}</Td>
                <Td chiffres>{p.derniereDeconnexion ? MOMENT.format(p.derniereDeconnexion) : "—"}</Td>
                <Td aligne="droite" chiffres>
                  <span className={p.echecsSeptJours > 0 ? "font-semibold text-danger-600" : ""}>{p.echecsSeptJours}</span>
                </Td>
                <Td aligne="droite" chiffres>{p.gestesSeptJours}</Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
        <p className="mt-3 max-w-[70ch] text-xs text-[var(--encre-faible)]">
          Le journal ne s&apos;efface pas, même par le propriétaire. Une personne qui ferme son navigateur sans se
          déconnecter n&apos;a pas de ligne de déconnexion : sa session expire d&apos;elle-même.
        </p>
      </section>
    </>
  );
}
