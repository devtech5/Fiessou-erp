import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import type { StatutContrat, StatutRessource } from "@/modules/reservations/schema";

import { departDe, etatChambre, nuitsEntre, soldeNote, type EtatChambre } from "./calcul";
import { acomptesSejour, prestationsSejour, voyageursSejour, type MenageChambre, type NaturePrestation } from "./schema";

const iso = (valeur: unknown): string =>
  valeur instanceof Date ? valeur.toISOString().slice(0, 10) : String(valeur).slice(0, 10);
const entierOuNul = (v: string | number | null) => (v === null ? null : Number(v));

export interface ChambreVue {
  id: string;
  code: string;
  designation: string;
  categorie: string | null;
  statut: StatutRessource;
  etage: string | null;
  capacite: number;
  menage: MenageChambre;
  tarifNuit: number | null;
  tarifSemaine: number | null;
  tarifMois: number | null;
  caution: number;
  etat: EtatChambre;
  /** Séjour présent ou attendu aujourd'hui. */
  sejour: { id: string; numero: string; client: string; arrivee: string; depart: string } | null;
}

/**
 * Le tableau de la réception : chaque chambre, son état du jour et le séjour
 * qui l'occupe ou l'attend. Une chambre créée depuis l'écran Réservations y
 * figure aussi, avec une fiche d'hôtel par défaut.
 */
export async function tableauDesChambres(organizationId: string, jour: string): Promise<ChambreVue[]> {
  const lignes = await db.execute<{
    id: string;
    code: string;
    designation: string;
    categorie: string | null;
    statut: StatutRessource;
    etage: string | null;
    capacite: number | null;
    menage: MenageChambre | null;
    tarif_jour: string | null;
    tarif_semaine: string | null;
    tarif_mois: string | null;
    caution: string;
    present_id: string | null;
    present_numero: string | null;
    present_client: string | null;
    present_debut: string | Date | null;
    present_fin: string | Date | null;
    attendu_id: string | null;
    attendu_numero: string | null;
    attendu_client: string | null;
    attendu_debut: string | Date | null;
    attendu_fin: string | Date | null;
  }>(sql`
    select r.id, r.code, r.designation, r.categorie, r.statut, r.tarif_jour, r.tarif_semaine, r.tarif_mois, r.caution,
           h.etage, h.capacite, h.menage,
           p.id as present_id, p.numero as present_numero, p.client as present_client, p.debut as present_debut, p.fin as present_fin,
           a.id as attendu_id, a.numero as attendu_numero, a.client as attendu_client, a.debut as attendu_debut, a.fin as attendu_fin
    from ressources r
      left join chambres_hotel h on h.ressource_id = r.id
      left join lateral (
        select s.id, c.numero, t.nom as client, c.debut, c.fin
        from contrats_location c
          join sejours_hotel s on s.contrat_id = c.id
          join tiers t on t.id = c.client_id
        where c.ressource_id = r.id and c.statut = 'en_cours'
        order by c.debut limit 1
      ) p on true
      left join lateral (
        select s.id, c.numero, t.nom as client, c.debut, c.fin
        from contrats_location c
          join sejours_hotel s on s.contrat_id = c.id
          join tiers t on t.id = c.client_id
        where c.ressource_id = r.id and c.statut = 'reserve' and c.debut <= ${jour} and c.fin >= ${jour}
        order by c.debut limit 1
      ) a on true
    where r.organization_id = ${organizationId} and r.type = 'chambre' and r.deleted_at is null and r.statut <> 'retiree'
    order by h.etage nulls first, r.code
  `);

  return lignes.map((l) => {
    const present = l.present_id
      ? { id: l.present_id, numero: l.present_numero ?? "", client: l.present_client ?? "", arrivee: iso(l.present_debut), depart: departDe(iso(l.present_fin)) }
      : null;
    const attendu = l.attendu_id
      ? { id: l.attendu_id, numero: l.attendu_numero ?? "", client: l.attendu_client ?? "", arrivee: iso(l.attendu_debut), depart: departDe(iso(l.attendu_fin)) }
      : null;
    const menage = l.menage ?? "propre";
    return {
      id: l.id,
      code: l.code,
      designation: l.designation,
      categorie: l.categorie,
      statut: l.statut,
      etage: l.etage,
      capacite: Number(l.capacite ?? 2),
      menage,
      tarifNuit: entierOuNul(l.tarif_jour),
      tarifSemaine: entierOuNul(l.tarif_semaine),
      tarifMois: entierOuNul(l.tarif_mois),
      caution: Number(l.caution),
      etat: etatChambre({ statut: l.statut, menage, departPrevu: present?.depart ?? null, arriveeAttendue: Boolean(attendu) }, jour),
      sejour: present ?? attendu,
    };
  });
}

export interface SejourVue {
  id: string;
  numero: string;
  chambre: string;
  client: string;
  arrivee: string;
  depart: string;
  nuits: number;
  personnes: number;
  statut: StatutContrat;
  montant: number;
  /** Note entière : hébergement et prestations, acomptes non déduits. */
  total: number;
  verse: number;
}

export async function listerSejours(organizationId: string): Promise<SejourVue[]> {
  const lignes = await db.execute<{
    id: string;
    numero: string;
    chambre: string;
    client: string;
    debut: string | Date;
    fin: string | Date;
    adultes: number;
    enfants: number;
    statut: StatutContrat;
    montant: string;
    consomme: string;
    verse: string;
  }>(sql`
    select s.id, c.numero, r.code as chambre, t.nom as client, c.debut, c.fin, s.adultes, s.enfants, c.statut, c.montant,
           coalesce((select sum(p.montant) from prestations_sejour p where p.sejour_id = s.id and p.deleted_at is null), 0) as consomme,
           coalesce((select sum(a.montant) from acomptes_sejour a where a.sejour_id = s.id), 0) as verse
    from sejours_hotel s
      join contrats_location c on c.id = s.contrat_id
      join ressources r on r.id = c.ressource_id
      join tiers t on t.id = c.client_id
    where s.organization_id = ${organizationId}
    order by case c.statut when 'en_cours' then 0 when 'reserve' then 1 else 2 end,
             case when c.statut in ('en_cours', 'reserve') then c.debut end asc,
             c.debut desc
    limit 300
  `);
  return lignes.map((l) => {
    const arrivee = iso(l.debut);
    const depart = departDe(iso(l.fin));
    return {
      id: l.id,
      numero: l.numero,
      chambre: l.chambre,
      client: l.client,
      arrivee,
      depart,
      nuits: nuitsEntre(arrivee, depart),
      personnes: Number(l.adultes) + Number(l.enfants),
      statut: l.statut,
      montant: Number(l.montant),
      total: Number(l.montant) + Number(l.consomme),
      verse: Number(l.verse),
    };
  });
}

export interface FicheSejour {
  id: string;
  contratId: string;
  numero: string;
  statut: StatutContrat;
  motif: string | null;
  chambre: { id: string; code: string; designation: string; categorie: string | null; tauxTva: number };
  client: { id: string; nom: string; telephone: string | null; aUnCompte: boolean };
  arrivee: string;
  depart: string;
  baseTarif: string;
  prixNuit: number | null;
  adultes: number;
  enfants: number;
  hebergement: number;
  caution: number;
  retenue: number;
  arriveeLe: Date | null;
  departLe: Date | null;
  notes: string | null;
  ecritures: string[];
  prestations: { id: string; jour: string; libelle: string; nature: NaturePrestation; quantite: number; prixUnitaire: number; montant: number; tauxTva: number }[];
  acomptes: { id: string; numero: string; jour: string; montant: number; moyen: string }[];
  voyageurs: (typeof voyageursSejour.$inferSelect)[];
  note: { total: number; verse: number; reste: number };
}

export async function ficheSejour(organizationId: string, sejourId: string): Promise<FicheSejour | null> {
  const [l] = await db.execute<{
    id: string;
    contrat_id: string;
    numero: string;
    statut: StatutContrat;
    motif: string | null;
    ressource_id: string;
    code: string;
    designation: string;
    categorie: string | null;
    taux_tva: number;
    client_id: string;
    client: string;
    telephone: string | null;
    compte_client: string | null;
    debut: string | Date;
    fin: string | Date;
    base_tarif: string;
    prix_nuit: string | null;
    adultes: number;
    enfants: number;
    montant: string;
    caution: string;
    retenue: string;
    arrivee_le: string | Date | null;
    depart_le: string | Date | null;
    notes: string | null;
    ecriture_caution: string | null;
    ecriture_depart: string | null;
    ecriture_restitution: string | null;
  }>(sql`
    select s.id, c.id as contrat_id, c.numero, c.statut, c.motif, r.id as ressource_id, r.code, r.designation, r.categorie, r.taux_tva,
           t.id as client_id, t.nom as client, t.telephone, t.compte_client, c.debut, c.fin, c.base_tarif, s.prix_nuit,
           s.adultes, s.enfants, c.montant, c.caution, c.retenue, s.arrivee_le, s.depart_le, c.notes,
           s.ecriture_caution, s.ecriture_depart, c.ecriture_restitution
    from sejours_hotel s
      join contrats_location c on c.id = s.contrat_id
      join ressources r on r.id = c.ressource_id
      join tiers t on t.id = c.client_id
    where s.id = ${sejourId} and s.organization_id = ${organizationId}
  `);
  if (!l) return null;

  const [prestations, acomptes, voyageurs] = await Promise.all([
    db
      .select()
      .from(prestationsSejour)
      .where(and(eq(prestationsSejour.sejourId, sejourId), isNull(prestationsSejour.deletedAt)))
      .orderBy(asc(prestationsSejour.jour), asc(prestationsSejour.createdAt)),
    db.select().from(acomptesSejour).where(eq(acomptesSejour.sejourId, sejourId)).orderBy(asc(acomptesSejour.createdAt)),
    db.select().from(voyageursSejour).where(eq(voyageursSejour.sejourId, sejourId)).orderBy(asc(voyageursSejour.createdAt)),
  ]);

  const hebergement = Number(l.montant);
  return {
    id: l.id,
    contratId: l.contrat_id,
    numero: l.numero,
    statut: l.statut,
    motif: l.motif,
    chambre: { id: l.ressource_id, code: l.code, designation: l.designation, categorie: l.categorie, tauxTva: Number(l.taux_tva) },
    client: { id: l.client_id, nom: l.client, telephone: l.telephone, aUnCompte: Boolean(l.compte_client) },
    arrivee: iso(l.debut),
    depart: departDe(iso(l.fin)),
    baseTarif: l.base_tarif,
    prixNuit: entierOuNul(l.prix_nuit),
    adultes: Number(l.adultes),
    enfants: Number(l.enfants),
    hebergement,
    caution: Number(l.caution),
    retenue: Number(l.retenue),
    arriveeLe: l.arrivee_le ? new Date(l.arrivee_le) : null,
    departLe: l.depart_le ? new Date(l.depart_le) : null,
    notes: l.notes,
    ecritures: [l.ecriture_caution, ...acomptes.map((a) => a.ecriture), l.ecriture_depart, l.ecriture_restitution].filter((e): e is string => Boolean(e)),
    prestations: prestations.map((p) => ({
      id: p.id,
      jour: iso(p.jour),
      libelle: p.libelle,
      nature: p.nature,
      quantite: p.quantite,
      prixUnitaire: p.prixUnitaire,
      montant: p.montant,
      tauxTva: p.tauxTva,
    })),
    acomptes: acomptes.map((a) => ({ id: a.id, numero: a.numero, jour: iso(a.jour), montant: a.montant, moyen: a.moyen })),
    voyageurs,
    note: soldeNote(hebergement, prestations, acomptes),
  };
}

export interface LigneRegistre {
  id: string;
  numero: string;
  chambre: string;
  arrivee: string;
  depart: string;
  parti: boolean;
  nom: string;
  prenoms: string | null;
  dateNaissance: string | null;
  lieuNaissance: string | null;
  nationalite: string;
  profession: string | null;
  domicile: string | null;
  pieceNature: string;
  pieceNumero: string;
  provenance: string | null;
  destination: string | null;
}

/** Registre de police : les voyageurs ARRIVÉS dont le séjour touche la période. */
export async function registreVoyageurs(organizationId: string, du: string, au: string): Promise<LigneRegistre[]> {
  const lignes = await db.execute<{
    id: string;
    numero: string;
    chambre: string;
    debut: string | Date;
    fin: string | Date;
    statut: StatutContrat;
    nom: string;
    prenoms: string | null;
    date_naissance: string | Date | null;
    lieu_naissance: string | null;
    nationalite: string;
    profession: string | null;
    domicile: string | null;
    piece_nature: string;
    piece_numero: string;
    provenance: string | null;
    destination: string | null;
  }>(sql`
    select v.id, c.numero, r.code as chambre, c.debut, c.fin, c.statut, v.nom, v.prenoms, v.date_naissance, v.lieu_naissance,
           v.nationalite, v.profession, v.domicile, v.piece_nature, v.piece_numero, v.provenance, v.destination
    from voyageurs_sejour v
      join sejours_hotel s on s.id = v.sejour_id
      join contrats_location c on c.id = s.contrat_id
      join ressources r on r.id = c.ressource_id
    where v.organization_id = ${organizationId}
      and s.arrivee_le is not null
      and c.debut <= ${au} and c.fin >= ${du}
    order by c.debut, r.code, v.created_at
  `);
  return lignes.map((l) => ({
    id: l.id,
    numero: l.numero,
    chambre: l.chambre,
    arrivee: iso(l.debut),
    depart: departDe(iso(l.fin)),
    parti: l.statut === "restitue",
    nom: l.nom,
    prenoms: l.prenoms,
    dateNaissance: l.date_naissance ? iso(l.date_naissance) : null,
    lieuNaissance: l.lieu_naissance,
    nationalite: l.nationalite,
    profession: l.profession,
    domicile: l.domicile,
    pieceNature: l.piece_nature,
    pieceNumero: l.piece_numero,
    provenance: l.provenance,
    destination: l.destination,
  }));
}

/** Clients proposés à la réservation. */
export async function clientsHotel(organizationId: string): Promise<{ id: string; nom: string }[]> {
  return db.execute<{ id: string; nom: string }>(sql`
    select id, nom from tiers
    where organization_id = ${organizationId} and est_client and actif and deleted_at is null
    order by nom`);
}
