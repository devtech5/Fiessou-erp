import { describe, expect, it } from "vitest";

import {
  GABARITS,
  PREFIXE_MISSION,
  avancement,
  cleDeChamp,
  estOuverte,
  estValidableEnOrdre,
  etapeCourante,
  libellePosition,
  positionValide,
  preuvesManquantes,
  statutApresEtape,
  versMicroDegres,
} from "@/modules/missions/suivi";

const fait = new Date("2026-08-26T09:12:00Z");

function etapes(...faites: boolean[]) {
  return faites.map((f, i) => ({
    id: `e${i + 1}`,
    ordre: i + 1,
    libelle: `Étape ${i + 1}`,
    preuvesRequises: [],
    faiteLe: f ? fait : null,
  }));
}

describe("avancement", () => {
  it("compte la part d'étapes accomplies, arrondie à l'entier", () => {
    expect(avancement(etapes(true, false, false))).toBe(33);
    expect(avancement(etapes(true, true, false))).toBe(67);
    expect(avancement(etapes(true, true, true))).toBe(100);
  });

  it("vaut zéro sans étape plutôt que de diviser par zéro", () => {
    expect(avancement([])).toBe(0);
  });
});

describe("preuvesManquantes", () => {
  it("réclame ce qui n'a pas été rapporté, une seule fois par nature", () => {
    expect(
      preuvesManquantes(["photo", "signature", "photo", "position"], ["position"]),
    ).toEqual(["photo", "signature"]);
  });

  it("ne réclame rien quand tout est là", () => {
    expect(preuvesManquantes(["photo"], ["photo", "note"])).toEqual([]);
  });

  it("ne réclame rien quand l'étape n'exige rien", () => {
    expect(preuvesManquantes([], [])).toEqual([]);
  });
});

describe("ordre des étapes", () => {
  it("l'étape courante est la première non accomplie", () => {
    expect(etapeCourante(etapes(true, false, false))?.id).toBe("e2");
    expect(etapeCourante(etapes(true, true, true))).toBeNull();
  });

  it("refuse de valider une étape en sautant la précédente", () => {
    const liste = etapes(true, false, false);
    expect(estValidableEnOrdre(liste, "e2")).toBe(true);
    expect(estValidableEnOrdre(liste, "e3")).toBe(false);
    expect(estValidableEnOrdre(liste, "e1")).toBe(false);
  });
});

describe("statutApresEtape", () => {
  it("démarre à la première étape, termine à la dernière", () => {
    expect(statutApresEtape("planifiee", etapes(true, false, false))).toBe("en_cours");
    expect(statutApresEtape("en_cours", etapes(true, true, true))).toBe("terminee");
  });

  it("ne défait pas une issue posée par une personne", () => {
    expect(statutApresEtape("echouee", etapes(true, true, true))).toBe("echouee");
    expect(statutApresEtape("annulee", etapes(true, false))).toBe("annulee");
  });

  it("ne bouge pas une mission sans étape", () => {
    expect(statutApresEtape("planifiee", [])).toBe("planifiee");
  });

  it("n'accepte de preuve que sur une mission ouverte", () => {
    expect(estOuverte("planifiee")).toBe(true);
    expect(estOuverte("en_cours")).toBe(true);
    expect(estOuverte("terminee")).toBe(false);
    expect(estOuverte("echouee")).toBe(false);
  });
});

describe("position", () => {
  it("passe en micro-degrés entiers, sans dérive", () => {
    expect(versMicroDegres(5.345317)).toBe(5_345_317);
    expect(versMicroDegres(-4.024429)).toBe(-4_024_429);
    expect(Number.isInteger(versMicroDegres(0.1 + 0.2))).toBe(true);
  });

  it("refuse une position hors du globe", () => {
    expect(positionValide(5_345_317, -4_024_429)).toBe(true);
    expect(positionValide(91_000_000, 0)).toBe(false);
    expect(positionValide(0, 181_000_000)).toBe(false);
    expect(positionValide(1.5, 0)).toBe(false);
  });

  it("s'écrit lisiblement avec l'hémisphère", () => {
    expect(libellePosition(5_345_317, -4_024_429)).toBe("5,345317 N, 4,024429 O");
  });
});

describe("gabarits", () => {
  it("existent pour chaque nature, avec un préfixe distinct", () => {
    const natures = Object.keys(PREFIXE_MISSION) as (keyof typeof GABARITS)[];
    expect(new Set(natures.map((n) => PREFIXE_MISSION[n])).size).toBe(natures.length);
    for (const nature of natures) expect(GABARITS[nature].length).toBeGreaterThan(0);
  });

  it("exige signature à la remise d'un colis", () => {
    const remise = GABARITS.livraison.at(-1);
    expect(remise?.preuves).toContain("signature");
  });
});

describe("cleDeChamp", () => {
  it("tire une clé stable du libellé, sans accent ni espace", () => {
    expect(cleDeChamp("Nom du gérant", new Set())).toBe("nom_du_gerant");
    expect(cleDeChamp("  Accepte le mobile money ?", new Set())).toBe(
      "accepte_le_mobile_money",
    );
  });

  it("distingue deux libellés qui donneraient la même clé", () => {
    const prises = new Set<string>();
    expect(cleDeChamp("Photo", prises)).toBe("photo");
    expect(cleDeChamp("photo", prises)).toBe("photo_2");
    expect(cleDeChamp("PHOTO", prises)).toBe("photo_3");
  });

  it("ne rend jamais une clé vide", () => {
    expect(cleDeChamp("???", new Set())).toBe("champ");
  });
});
