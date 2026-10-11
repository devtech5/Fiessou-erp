import { CarteIndicateur, EnTetePage, EtatVide } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { peut } from "@/lib/droits/garde";
import { fmtCompact, fmtEntier } from "@/lib/format";
import { DROITS_ESPACE, ESPACES, etatTable, minutesDepuis, type Espace } from "@/modules/restauration/calcul";
import { commandesEnCours, journeeSalle, tablesDeLEspace } from "@/modules/restauration/requetes";

import { Rafraichissement } from "./rafraichissement";
import { TuilesSalle, type CommandeTuile, type TableTuile } from "./tuiles-salle";

/** Minuit à Abidjan, qui vit à l'heure UTC toute l'année. */
function debutDuJour(maintenant: Date): Date {
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
}

/**
 * Plan de salle : chaque table, libre ou occupée, ce qu'elle doit et depuis
 * quand. Une table dont un plat attend d'être porté se signale : c'est ce que
 * le serveur cherche du regard en traversant la salle.
 */
export async function PlanDeSalle({ espace }: { espace: Espace }) {
  const session = await exigerEntreprise();
  const definition = ESPACES[espace];
  const maintenant = new Date();

  const [tables, commandes, journee, prendre, gerer] = await Promise.all([
    tablesDeLEspace(session.organizationId, espace),
    commandesEnCours(session.organizationId, espace),
    journeeSalle(session.organizationId, espace, debutDuJour(maintenant)),
    peut(DROITS_ESPACE[espace].prendre),
    peut(DROITS_ESPACE[espace].gerer),
  ]);

  const vues: CommandeTuile[] = commandes.map((c) => ({
    id: c.id,
    numero: c.numero,
    tableId: c.tableId,
    libelle: c.libelle,
    couverts: c.couverts,
    serveur: c.serveur,
    minutes: minutesDepuis(c.ouverteLe, maintenant),
    total: c.total,
    enPreparation: c.lignesEnPreparation,
    pretes: c.lignesPretes,
    etat: etatTable({ lignesPretes: c.lignesPretes }),
  }));
  const tuiles: TableTuile[] = tables.map((t) => ({ id: t.id, nom: t.nom, zone: t.zone, places: t.places }));

  const occupees = vues.filter((c) => c.tableId !== null).length;
  const enCours = vues.reduce((s, c) => s + c.total, 0);

  return (
    <>
      <Rafraichissement secondes={20} />
      <EnTetePage
        titre={definition.titre}
        sousTitre={
          tables.length === 0
            ? "Aucune table"
            : `${tables.length} table${tables.length > 1 ? "s" : ""} · ${occupees} occupée${occupees > 1 ? "s" : ""}`
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <CarteIndicateur libelle="Tables occupées" valeur={`${occupees} / ${tables.length}`} precision={`${vues.length - occupees} à emporter en cours`} />
        <CarteIndicateur libelle="En cours" valeur={fmtCompact(enCours)} unite="FCFA" precision="Additions ouvertes" />
        <CarteIndicateur
          libelle="Encaissé aujourd'hui"
          valeur={fmtCompact(journee.chiffreAffaires)}
          unite="FCFA"
          precision={`${fmtEntier(journee.commandesEncaissees)} table${journee.commandesEncaissees > 1 ? "s" : ""}${journee.annulees > 0 ? ` · ${journee.annulees} annulée${journee.annulees > 1 ? "s" : ""}` : ""}`}
          ton="valide"
        />
        <CarteIndicateur
          libelle={definition.couverts ? "Couverts du jour" : "Addition moyenne"}
          valeur={definition.couverts ? fmtEntier(journee.couverts) : fmtCompact(journee.ticketMoyen)}
          unite={definition.couverts ? undefined : "FCFA"}
          precision={definition.couverts ? `Addition moyenne ${fmtCompact(journee.ticketMoyen)} F` : "Par table encaissée"}
        />
      </section>

      {tables.length === 0 && vues.length === 0 ? (
        <EtatVide
          titre="Aucune table"
          message={
            gerer
              ? "Ajoutez vos tables — salle, terrasse, VIP — dans « Tables et encaissement », avec le poste qui encaissera la salle. Les commandes à emporter n'en ont pas besoin."
              : "Le responsable de la salle n'a pas encore créé les tables."
          }
        />
      ) : null}

      <TuilesSalle espace={espace} tables={tuiles} commandes={vues} peutPrendre={prendre} couverts={definition.couverts} />
    </>
  );
}
