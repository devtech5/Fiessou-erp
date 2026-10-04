import type { ArchiveVue } from "@/modules/archives/requetes";

import type { ArchiveAffichee } from "./liste-archives";

/** Ce que la liste reçoit : des dates en ISO, rien qui dépende du fuseau du serveur. */
export function affichee(a: ArchiveVue): ArchiveAffichee {
  return {
    id: a.id,
    numero: a.numero,
    titre: a.titre,
    dossier: a.dossier,
    dossierPartage: a.dossierPartage,
    description: a.description,
    nomFichier: a.nomFichier,
    typeMime: a.typeMime,
    tailleOctets: a.tailleOctets,
    empreinte: a.empreinte,
    deposeLeIso: a.deposeLe.toISOString(),
    retireeLeIso: a.retireeLe?.toISOString() ?? null,
    motifRetrait: a.motifRetrait,
    auteur: a.auteur,
    auteurId: a.auteurId,
    consultationsParAutres: a.consultationsParAutres,
    verification: a.derniereVerification
      ? { leIso: a.derniereVerification.le.toISOString(), etat: a.derniereVerification.etat }
      : null,
  };
}
