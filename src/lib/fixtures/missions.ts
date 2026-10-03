import "server-only";

import { asc, eq } from "drizzle-orm";

import { newId } from "@/lib/ids";
import type { Transaction } from "@/lib/sequences";
import {
  cloreMissionDans,
  creerFormulaireDans,
  creerMissionDans,
  enregistrerPreuveDans,
  validerEtapeDans,
} from "@/modules/missions/creation";
import { etapesMission, type NatureMission, type TypePreuve } from "@/modules/missions/schema";
import { versMicroDegres } from "@/modules/missions/suivi";

/**
 * Amorçage des missions de démonstration.
 *
 * Un seul moteur porte six entrées du périmètre : livraison, BTP, gestion de
 * projet, collecte de terrain, exploitation agricole et ONG. Le jeu passe par
 * les VRAIES fonctions du module — création, preuve, validation d'étape,
 * clôture — et non par des insertions directes : il prouve au passage que les
 * règles (ordre des étapes, preuves exigées) laissent bien passer un parcours
 * réel.
 *
 * Aucune étape de démonstration n'exige de photo : une photo est un fichier du
 * dépôt, et en fabriquer un faux donnerait un lien mort derrière « Ouvrir la
 * photo ». Les étapes à photo se testent en vrai, sur un téléphone.
 */

interface EtapeDemo {
  libelle: string;
  preuves: TypePreuve[];
  /** Heures écoulées depuis la validation, quand l'étape est faite. */
  ilYaHeures?: number;
  note?: string;
  signataire?: string;
}

interface MissionDemo {
  nature: NatureMission;
  titre: string;
  executant?: string;
  lieu: string;
  client?: string;
  montant?: number;
  /** Décalage de l'échéance en heures depuis maintenant (négatif : passée). */
  echeanceHeures: number;
  /** Repère GPS approximatif du lieu, en degrés décimaux. */
  position: [number, number];
  etapes: EtapeDemo[];
  issue?: { type: "echouee" | "annulee"; motif: string };
}

const MISSIONS_DEMO: MissionDemo[] = [
  {
    nature: "livraison",
    titre: "Colis — 3 cartons électroménager",
    executant: "Touré Mamadou",
    lieu: "Cocody Angré, Abidjan",
    client: "Restaurant Akwaba",
    montant: 15_000,
    echeanceHeures: 6,
    position: [5.4041, -3.9931],
    etapes: [
      { libelle: "Colis collecté au dépôt", preuves: ["position", "note"], ilYaHeures: 5, note: "3 cartons, scellés intacts" },
      { libelle: "En transit", preuves: ["position"], ilYaHeures: 4 },
      { libelle: "Remis au destinataire", preuves: ["signature", "position"] },
    ],
  },
  {
    nature: "livraison",
    titre: "Déménagement — studio meublé",
    executant: "Konan Michel",
    lieu: "Marcory Zone 4, Abidjan",
    client: "Kouadio Yao",
    montant: 85_000,
    echeanceHeures: -30,
    position: [5.3009, -3.9997],
    etapes: [
      { libelle: "Chargement", preuves: ["position", "note"], ilYaHeures: 32, note: "Mobilier complet, 2 matelas" },
      { libelle: "En transit", preuves: ["position"], ilYaHeures: 31 },
      { libelle: "Déchargement et remise", preuves: ["signature", "position"], ilYaHeures: 29, signataire: "Kouadio Yao" },
    ],
  },
  {
    nature: "livraison",
    titre: "Colis — pièces détachées",
    executant: "Touré Mamadou",
    lieu: "Bingerville",
    client: "Quincaillerie Adjamé",
    montant: 12_000,
    echeanceHeures: -28,
    position: [5.3558, -3.8847],
    etapes: [
      { libelle: "Colis collecté au dépôt", preuves: ["position"], ilYaHeures: 30 },
      { libelle: "En transit", preuves: ["position"], ilYaHeures: 29 },
      { libelle: "Remis au destinataire", preuves: ["signature", "position"] },
    ],
    issue: { type: "echouee", motif: "Destinataire absent, boutique fermée à 16 h 42" },
  },
  {
    nature: "chantier",
    titre: "Élévation murs — niveau R+1",
    executant: "Ouattara Ibrahim",
    lieu: "Villa Riviera 3, Abidjan",
    echeanceHeures: 96,
    position: [5.3664, -3.9788],
    etapes: [
      { libelle: "Matériaux réceptionnés", preuves: ["note", "position"], ilYaHeures: 190, note: "120 agglos, 14 sacs de ciment" },
      { libelle: "Ferraillage posé", preuves: ["note"], ilYaHeures: 140, note: "Chaînage conforme au plan" },
      { libelle: "Élévation en cours", preuves: ["position"] },
      { libelle: "Réception du lot", preuves: ["signature", "note"] },
    ],
  },
  {
    nature: "chantier",
    titre: "Coffrage dalle — niveau RDC",
    executant: "Coulibaly Yaya",
    lieu: "Immeuble Cocody, Abidjan",
    echeanceHeures: -170,
    position: [5.3599, -3.9917],
    etapes: [
      { libelle: "Coffrage monté", preuves: ["note"], ilYaHeures: 240, note: "Étais tous les 80 cm" },
      { libelle: "Contrôle avant coulage", preuves: ["note", "signature"], ilYaHeures: 200, signataire: "Bureau de contrôle" },
      { libelle: "Réception du lot", preuves: ["signature"], ilYaHeures: 180, signataire: "Maître d'ouvrage" },
    ],
  },
  {
    nature: "collecte",
    titre: "Recensement points de vente — Yamoussoukro",
    executant: "Yao Prince",
    lieu: "Yamoussoukro",
    echeanceHeures: 72,
    position: [6.8276, -5.2893],
    etapes: [
      { libelle: "Zone 1 — centre", preuves: ["position", "note"], ilYaHeures: 70, note: "42 points recensés" },
      { libelle: "Zone 2 — Habitat", preuves: ["position"], ilYaHeures: 46 },
      { libelle: "Zone 3 — Kokrenou", preuves: ["position"] },
    ],
  },
  {
    nature: "projet",
    titre: "Ouverture point de vente Bouaké",
    executant: "Koffi Bernard",
    lieu: "Bouaké",
    echeanceHeures: 24 * 40,
    position: [7.6906, -5.0303],
    etapes: [
      { libelle: "Local identifié", preuves: ["note"], ilYaHeures: 24 * 50, note: "Rez-de-chaussée, 60 m², avenue principale" },
      { libelle: "Bail signé", preuves: ["signature"], ilYaHeures: 24 * 40, signataire: "Koffi Bernard" },
      { libelle: "Aménagement", preuves: ["note"] },
      { libelle: "Recrutement équipe", preuves: ["note"] },
      { libelle: "Ouverture", preuves: ["note"] },
    ],
  },
  {
    nature: "livraison",
    titre: "Colis — fournitures bureau",
    executant: "Konan Michel",
    lieu: "Plateau, Abidjan",
    client: "Pharmacie du Plateau",
    montant: 8_000,
    echeanceHeures: 20,
    position: [5.3235, -4.0178],
    etapes: [
      { libelle: "Colis collecté au dépôt", preuves: ["position"] },
      { libelle: "En transit", preuves: ["position"] },
      { libelle: "Remis au destinataire", preuves: ["signature", "position"] },
    ],
  },
];

const FORMULAIRES_DEMO = [
  {
    nom: "Fiche point de vente",
    usage: "Recensement terrain",
    champs: [
      { cle: "enseigne", libelle: "Enseigne", type: "texte", obligatoire: true },
      { cle: "nom_du_gerant", libelle: "Nom du gérant", type: "texte", obligatoire: true },
      { cle: "telephone", libelle: "Téléphone", type: "texte", obligatoire: true },
      {
        cle: "type_de_commerce",
        libelle: "Type de commerce",
        type: "choix",
        obligatoire: true,
        options: ["Boutique", "Kiosque", "Marché", "Grande surface"],
      },
      { cle: "nombre_de_caisses", libelle: "Nombre de caisses", type: "nombre", obligatoire: false },
      { cle: "coordonnees_gps", libelle: "Coordonnées GPS", type: "position", obligatoire: true },
      { cle: "accepte_le_mobile_money", libelle: "Accepte le mobile money", type: "oui_non", obligatoire: false },
    ],
  },
  {
    nom: "Constat de livraison",
    usage: "Livraison",
    champs: [
      {
        cle: "etat_du_colis",
        libelle: "État du colis",
        type: "choix",
        obligatoire: true,
        options: ["Intact", "Abîmé", "Incomplet"],
      },
      { cle: "observation", libelle: "Observation", type: "texte", obligatoire: false },
    ],
  },
  {
    nom: "Réception de lot",
    usage: "Chantier",
    champs: [
      { cle: "lot_receptionne", libelle: "Lot réceptionné", type: "texte", obligatoire: true },
      { cle: "conforme_au_plan", libelle: "Conforme au plan", type: "oui_non", obligatoire: true },
      { cle: "reserves", libelle: "Réserves", type: "texte", obligatoire: false },
    ],
  },
] as const;

export interface RepereMissions {
  employes: Map<string, string>;
  intervenants: Map<string, string>;
  /** Clients par nom. */
  clients: Map<string, string>;
}

const HEURE = 60 * 60 * 1000;

/** Verse les missions et formulaires de démonstration dans l'entreprise. */
export async function amorcerMissions(
  tx: Transaction,
  organizationId: string,
  reperes: RepereMissions,
  userId?: string,
): Promise<{ missions: number; preuves: number; formulaires: number }> {
  const maintenant = Date.now();
  let preuves = 0;

  for (const demo of MISSIONS_DEMO) {
    const employeId = demo.executant ? reperes.employes.get(demo.executant) : undefined;
    const intervenantId =
      demo.executant && !employeId ? reperes.intervenants.get(demo.executant) : undefined;

    const { id: missionId } = await creerMissionDans(
      tx,
      organizationId,
      {
        nature: demo.nature,
        titre: demo.titre,
        lieu: demo.lieu,
        employeId: employeId ?? null,
        intervenantId: intervenantId ?? null,
        clientId: demo.client ? (reperes.clients.get(demo.client) ?? null) : null,
        montant: demo.montant ?? 0,
        echeanceLe: new Date(maintenant + demo.echeanceHeures * HEURE),
        etapes: demo.etapes.map((e) => ({ libelle: e.libelle, preuves: e.preuves })),
      },
      userId,
    );

    // Les étapes se relisent dans l'ordre pour leur attacher leurs preuves.
    const etapes = await tx
      .select()
      .from(etapesMission)
      .where(eq(etapesMission.missionId, missionId))
      .orderBy(asc(etapesMission.ordre));

    for (const [index, etape] of demo.etapes.entries()) {
      if (etape.ilYaHeures === undefined) break;

      const prise = new Date(maintenant - etape.ilYaHeures * HEURE);
      const idEtape = etapes[index].id;

      for (const type of etape.preuves) {
        const resultat = await enregistrerPreuveDans(
          tx,
          organizationId,
          {
            id: newId(),
            missionId,
            etapeId: idEtape,
            type,
            texte:
              type === "note"
                ? (etape.note ?? "RAS")
                : type === "signature"
                  ? (etape.signataire ?? "Destinataire")
                  : null,
            latitudeMicro:
              type === "position" ? versMicroDegres(demo.position[0] + index * 0.002) : null,
            longitudeMicro:
              type === "position" ? versMicroDegres(demo.position[1] + index * 0.002) : null,
            priseLe: prise,
          },
          userId,
        );
        if (!resultat.ok) throw new Error(`Amorçage missions : ${resultat.message}`);
        preuves += 1;
      }

      const validation = await validerEtapeDans(tx, organizationId, idEtape, {
        faiteLe: prise,
        userId,
      });
      if (!validation.ok) throw new Error(`Amorçage missions : ${validation.message}`);
    }

    if (demo.issue) {
      await cloreMissionDans(
        tx,
        organizationId,
        missionId,
        demo.issue.type,
        demo.issue.motif,
        userId,
      );
    }
  }

  for (const formulaire of FORMULAIRES_DEMO) {
    await creerFormulaireDans(
      tx,
      organizationId,
      {
        nom: formulaire.nom,
        usage: formulaire.usage,
        champs: formulaire.champs.map((c) => ({ ...c, options: "options" in c ? [...c.options] : undefined })),
      },
      userId,
    );
  }

  return {
    missions: MISSIONS_DEMO.length,
    preuves,
    formulaires: FORMULAIRES_DEMO.length,
  };
}
