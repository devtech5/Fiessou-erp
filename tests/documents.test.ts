import { describe, expect, it } from "vitest";

import { cheminDe } from "@/lib/stockage";
import { joursAvant } from "@/modules/documents/requetes";

const ORG = "01a038e7-83ef-767a-85b4-489f98301d02";
const DOC = "01a03c27-4f11-7143-8855-9827b205f6f8";

describe("chemin d'un fichier dans le dépôt", () => {
  /**
   * L'entreprise vient EN TÊTE, pas en suffixe : c'est ce qui permettra
   * d'isoler les fichiers par une policy de stockage sur le préfixe, comme
   * `organization_id` isole les lignes. Un chemin qui mêle les entreprises ne
   * se rattrape pas après coup.
   */
  it("préfixe par l'entreprise", () => {
    expect(cheminDe(ORG, DOC, "pdf")).toBe(`${ORG}/${DOC}.pdf`);
    expect(cheminDe(ORG, DOC, "pdf").startsWith(`${ORG}/`)).toBe(true);
  });

  it("nomme par l'identifiant du document, jamais par le nom d'origine", () => {
    // Deux fichiers homonymes déposés le même jour ne doivent pas s'écraser.
    const premier = cheminDe(ORG, DOC, "pdf");
    const second = cheminDe(ORG, "01a03c27-4f11-7143-8855-9827b205f6f9", "pdf");
    expect(premier).not.toBe(second);
  });

  it("nettoie l'extension", () => {
    expect(cheminDe(ORG, DOC, "PDF")).toBe(`${ORG}/${DOC}.pdf`);
    expect(cheminDe(ORG, DOC, ".jpeg")).toBe(`${ORG}/${DOC}.jpeg`);
    // Une extension qui tenterait de remonter d'un dossier ne doit rien pouvoir.
    expect(cheminDe(ORG, DOC, "../../etc")).toBe(`${ORG}/${DOC}.etc`);
    expect(cheminDe(ORG, DOC, "")).toBe(`${ORG}/${DOC}`);
  });

  it("ne produit jamais de chemin hors du dossier de l'entreprise", () => {
    for (const extension of ["pdf", "../secret", "a/b", "..", "%2e%2e"]) {
      const chemin = cheminDe(ORG, DOC, extension);
      expect(chemin.split("/")).toHaveLength(2);
      expect(chemin.startsWith(`${ORG}/`)).toBe(true);
    }
  });
});

describe("expiration d'un document", () => {
  const aujourdhui = new Date("2026-08-26T09:00:00Z");

  it("compte les jours restants, et le retard en négatif", () => {
    expect(joursAvant("2026-08-31", aujourdhui)).toBe(5);
    expect(joursAvant("2026-08-26", aujourdhui)).toBe(0);
    expect(joursAvant("2026-07-31", aujourdhui)).toBe(-26);
  });

  /** L'heure de la journée ne doit pas déplacer une échéance d'un jour. */
  it("ne dépend pas de l'heure du jour", () => {
    expect(joursAvant("2026-09-30", new Date("2026-08-26T23:30:00Z"))).toBe(
      joursAvant("2026-09-30", new Date("2026-08-26T00:10:00Z")),
    );
  });

  it("refuse une date illisible plutôt que d'inventer une échéance", () => {
    expect(joursAvant("pas une date", aujourdhui)).toBeNull();
  });
});
