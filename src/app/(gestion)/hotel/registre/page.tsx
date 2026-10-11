import type { Metadata } from "next";

import { BoutonImprimer } from "@/components/ui/bouton-imprimer";
import { CLASSE_CHAMP, EnTetePage, EtatVide, Tableau, Td, Th } from "@/components/ui/primitives";
import { exigerEntreprise } from "@/lib/auth/dal";
import { fmtPeriode } from "@/lib/format";
import { aujourdHuiPour } from "@/modules/hotellerie/creation";
import { registreVoyageurs } from "@/modules/hotellerie/requetes";

export const metadata: Metadata = { title: "Registre des voyageurs" };

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const date = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "");

/**
 * Registre de police : les voyageurs qui ont dormi dans l'établissement sur la
 * période, tels qu'inscrits sur leur fiche. Il s'imprime pour les autorités.
 */
export default async function PageRegistre({ searchParams }: { searchParams: Promise<{ du?: string; au?: string }> }) {
  const session = await exigerEntreprise();
  const jour = await aujourdHuiPour(session.organizationId);
  const filtre = await searchParams;
  const du = filtre.du && DATE_ISO.test(filtre.du) ? filtre.du : `${jour.slice(0, 7)}-01`;
  const au = filtre.au && DATE_ISO.test(filtre.au) && filtre.au >= du ? filtre.au : jour;
  const lignes = await registreVoyageurs(session.organizationId, du, au);

  return (
    <>
      <EnTetePage
        titre="Registre des voyageurs"
        sousTitre={`Du ${date(du)} au ${date(au)} · ${lignes.length} voyageur${lignes.length > 1 ? "s" : ""}`}
        actions={
          <div className="print:hidden">
            <BoutonImprimer />
          </div>
        }
      />

      <form className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--encre-faible)]">Du</span>
          <input name="du" type="date" defaultValue={du} className={`${CLASSE_CHAMP} chiffres`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--encre-faible)]">Au</span>
          <input name="au" type="date" defaultValue={au} className={`${CLASSE_CHAMP} chiffres`} />
        </label>
        <button type="submit" className="h-cible rounded-lg border border-[var(--filet)] px-3.5 text-sm font-medium hover:bg-[var(--surface-creuse)]">
          Afficher
        </button>
      </form>

      {lignes.length === 0 ? (
        <EtatVide titre="Aucun voyageur sur la période" message="Un voyageur entre au registre quand il est installé en chambre, avec sa fiche de police." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <Th>Chambre</Th>
              <Th>Séjour</Th>
              <Th>Nom et prénoms</Th>
              <Th>Naissance</Th>
              <Th>Nationalité · profession</Th>
              <Th>Pièce d&apos;identité</Th>
              <Th>Domicile</Th>
              <Th>Venant de · allant à</Th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <Td chiffres fort>{l.chambre}</Td>
                <Td chiffres>
                  {fmtPeriode(l.arrivee, l.depart)}
                  <span className="block text-xs text-[var(--encre-faible)]">{l.numero}{l.parti ? "" : " · présent"}</span>
                </Td>
                <Td fort>
                  {l.nom} {l.prenoms}
                </Td>
                <Td chiffres>
                  {date(l.dateNaissance)}
                  {l.lieuNaissance && <span className="block text-xs text-[var(--encre-faible)]">{l.lieuNaissance}</span>}
                </Td>
                <Td>
                  {l.nationalite}
                  {l.profession && <span className="block text-xs text-[var(--encre-faible)]">{l.profession}</span>}
                </Td>
                <Td chiffres>
                  {l.pieceNature} {l.pieceNumero}
                </Td>
                <Td>{l.domicile ?? ""}</Td>
                <Td>{[l.provenance, l.destination].filter(Boolean).join(" → ")}</Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  );
}
