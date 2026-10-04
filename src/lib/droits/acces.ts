import { DROITS, type Droit } from "./catalogue";

/**
 * Restrictions d'accès par module.
 *
 * Deux leviers resserrent ce que le rôle accorde, sans jamais rien y ajouter :
 *
 *   · le module COUPÉ pour l'entreprise — il disparaît pour tout le monde,
 *     propriétaire compris (c'est lui qui le rallume) ;
 *   · le NIVEAU d'une personne sur un module — aucun, consultation ou complet.
 *
 * Logique pure : la garde l'applique, les tests la figent.
 */

export type NiveauAcces = "aucun" | "consultation" | "complet";

/** Le transverse — membres, paramètres — ne se coupe pas et ne se restreint pas. */
const TRANSVERSE = "organisation";

/** Un droit de consultation : il fait voir, il ne fait rien changer. */
export function estConsultation(cle: string): boolean {
  return cle.endsWith(".consulter");
}

const MODULE_DU_DROIT = new Map<string, string>(DROITS.map((d) => [d.cle, d.moduleKey]));

export interface Restrictions {
  /** Modules coupés pour toute l'entreprise. */
  modulesCoupes: ReadonlySet<string>;
  /** Niveau de la personne par module. Absent : complet. */
  niveaux: ReadonlyMap<string, NiveauAcces>;
  /** Le propriétaire n'est jamais restreint par les niveaux. */
  estProprietaire: boolean;
}

export function appliquerRestrictions(
  droits: ReadonlySet<Droit>,
  restrictions: Restrictions,
): Set<Droit> {
  const effectifs = new Set<Droit>();

  for (const droit of droits) {
    const cleModule = MODULE_DU_DROIT.get(droit);
    if (!cleModule || cleModule === TRANSVERSE) {
      effectifs.add(droit);
      continue;
    }
    if (restrictions.modulesCoupes.has(cleModule)) continue;
    if (restrictions.estProprietaire) {
      effectifs.add(droit);
      continue;
    }

    const niveau = restrictions.niveaux.get(cleModule) ?? "complet";
    if (niveau === "aucun") continue;
    if (niveau === "consultation" && !estConsultation(droit)) continue;
    effectifs.add(droit);
  }

  return effectifs;
}

/**
 * Niveau EFFECTIF d'une personne sur un module, compte tenu de son rôle.
 * Sert à l'écran : « complet » demandé pour un caissier sur la comptabilité
 * ne donne que ce que son rôle permet, et l'écran doit le dire.
 */
export function niveauEffectif(
  droitsDuRole: ReadonlySet<Droit>,
  cleModule: string,
  niveau: NiveauAcces,
): NiveauAcces {
  if (niveau === "aucun") return "aucun";
  const duModule = DROITS.filter((d) => d.moduleKey === cleModule && droitsDuRole.has(d.cle));
  if (duModule.length === 0) return "aucun";
  if (niveau === "consultation" || duModule.every((d) => estConsultation(d.cle))) {
    return duModule.some((d) => estConsultation(d.cle)) ? "consultation" : "aucun";
  }
  return "complet";
}
