import { EnTetePage, EtatVide, Pastille, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { DROITS_ESPACE, ESPACES, type Espace } from "@/modules/restauration/calcul";
import { postesDeSalle, tablesDeLEspace } from "@/modules/restauration/requetes";
import { listerDepots } from "@/modules/stock/requetes";

import { BasculerTable, FormulairePosteSalle, FormulaireTable } from "./formulaires-salle";

/**
 * Les tables de l'espace et le poste qui encaisse la salle.
 *
 * Le poste de salle n'est pas une caisse : aucun appareil ne s'y rattache, et
 * c'est le serveur qui numérote ses tickets. Une caisse du comptoir garde sa
 * propre suite, tenue sur son terminal.
 */
export async function GestionSalle({ espace }: { espace: Espace }) {
  const session = await exigerEntreprise();
  const definition = ESPACES[espace];
  const [tables, postes, depots, gerer] = await Promise.all([
    tablesDeLEspace(session.organizationId, espace, true),
    postesDeSalle(session.organizationId),
    listerDepots(session.organizationId),
    peut(DROITS_ESPACE[espace].gerer),
  ]);
  const zones = [...new Set(tables.map((t) => t.zone).filter((z): z is string => Boolean(z)))].sort();

  return (
    <>
      <EnTetePage
        titre="Tables et encaissement"
        sousTitre={`${definition.titre} · ${tables.filter((t) => t.actif).length} table${tables.length > 1 ? "s" : ""} sur le plan`}
        actions={gerer ? <FormulaireTable espace={espace} zones={zones} /> : undefined}
      />

      {tables.length === 0 ? (
        <EtatVide titre="Aucune table" message="Ajoutez les tables de la salle, de la terrasse ou de l'espace VIP. Elles apparaissent aussitôt sur le plan de salle." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Table</Th>
              <Th>Zone</Th>
              <Th aligne="droite">Places</Th>
              <Th>État</Th>
              {gerer && <Th aligne="droite">{""}</Th>}
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.id}>
                <Td fort>{t.nom}</Td>
                <Td>{t.zone ?? "Salle"}</Td>
                <Td aligne="droite" chiffres>
                  {t.places ?? "—"}
                </Td>
                <Td>{t.actif ? <Pastille ton="valide">Sur le plan</Pastille> : <Pastille>Retirée</Pastille>}</Td>
                {gerer && (
                  <Td aligne="droite">
                    <BasculerTable espace={espace} tableId={t.id} actif={t.actif} />
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Postes d&apos;encaissement de salle</h2>
            <p className="text-sm text-[var(--encre-douce)]">
              Ils numérotent les tickets des tables encaissées depuis la commande, et sortent le stock de leur dépôt.
            </p>
          </div>
          {gerer && <FormulairePosteSalle espace={espace} depots={depots.map((d) => ({ id: d.id, nom: d.nom }))} />}
        </div>
        {depots.length === 0 && gerer && (
          <p className="mb-3 text-sm text-alerte-600">Ouvrez d&apos;abord un dépôt dans Stock : le poste de salle y prend ses boissons.</p>
        )}
        {postes.length === 0 ? (
          <p className="text-sm text-[var(--encre-faible)]">Aucun poste de salle : les tables ne peuvent pas encore être encaissées.</p>
        ) : (
          <ul className="divide-y divide-[var(--filet)] rounded-xl border border-[var(--filet)] bg-[var(--surface)]">
            {postes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{p.nom}</span> <span className="chiffres text-[var(--encre-faible)]">{p.prefixe}</span>
                </span>
                <span className="text-[var(--encre-douce)]">
                  {p.depotNom} · <span className="chiffres">{p.dernierNumero}</span> ticket{p.dernierNumero > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
