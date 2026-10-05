import { describe, expect, it } from "vitest";

import { ajouterMois, estDroitDeLecture, etatAbonnement, periodeCouverte } from "@/lib/abonnement/calcul";

describe("état de l'abonnement", () => {
  const essai = (fin: string) => ({ statut: "essai" as const, essaiFinLe: fin, payeJusquAu: null });

  it("compte les jours d'essai et prévient à l'approche de la fin", () => {
    expect(etatAbonnement(essai("2026-10-20"), "2026-10-05")).toMatchObject({ phase: "essai", acces: "complet", jours: 15, gravite: "info" });
    expect(etatAbonnement(essai("2026-10-07"), "2026-10-05")).toMatchObject({ gravite: "attention" });
  });

  it("laisse sept jours de grâce puis passe en lecture seule, jamais en coupure", () => {
    expect(etatAbonnement(essai("2026-10-01"), "2026-10-05")).toMatchObject({ phase: "grace", acces: "complet" });
    expect(etatAbonnement(essai("2026-10-01"), "2026-10-08")).toMatchObject({ phase: "grace", acces: "complet" });
    expect(etatAbonnement(essai("2026-10-01"), "2026-10-09")).toMatchObject({ phase: "expire", acces: "lecture" });
  });

  it("un paiement l'emporte sur l'essai ; pas de bandeau loin de l'échéance", () => {
    const e = etatAbonnement({ statut: "actif", essaiFinLe: "2026-09-01", payeJusquAu: "2026-12-31" }, "2026-10-05");
    expect(e).toMatchObject({ phase: "actif", acces: "complet", finLe: "2026-12-31", message: null });
    expect(etatAbonnement({ statut: "actif", essaiFinLe: null, payeJusquAu: "2026-10-10" }, "2026-10-05").gravite).toBe("attention");
  });

  it("suspendu ou résilié : lecture seule immédiate", () => {
    expect(etatAbonnement({ statut: "suspendu", essaiFinLe: null, payeJusquAu: "2027-01-01" }, "2026-10-05").acces).toBe("lecture");
    expect(etatAbonnement({ statut: "resilie", essaiFinLe: null, payeJusquAu: null }, "2026-10-05").acces).toBe("lecture");
  });

  it("ne garde en lecture seule que la consultation", () => {
    expect(estDroitDeLecture("stock.article.consulter")).toBe(true);
    expect(estDroitDeLecture("ventes.encaisser")).toBe(false);
  });
});

describe("période couverte par un paiement", () => {
  it("prolonge sans perdre de jours un abonné à jour", () => {
    expect(periodeCouverte("2026-10-31", "2026-10-05", 1)).toEqual({ du: "2026-11-01", au: "2026-11-30" });
    expect(periodeCouverte("2026-10-31", "2026-10-05", 12)).toEqual({ du: "2026-11-01", au: "2027-10-31" });
  });

  it("repart d'aujourd'hui pour un abonnement échu ou une première souscription", () => {
    expect(periodeCouverte("2026-08-31", "2026-10-05", 1)).toEqual({ du: "2026-10-05", au: "2026-11-04" });
    expect(periodeCouverte(null, "2026-10-05", 3)).toEqual({ du: "2026-10-05", au: "2027-01-04" });
  });

  it("corrige par un nombre de mois négatif, et garde le dernier jour du mois", () => {
    expect(periodeCouverte("2026-12-31", "2026-10-05", -1).au).toBe("2026-11-30");
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2028-01-31", 1)).toBe("2028-02-29");
    expect(() => periodeCouverte(null, "2026-10-05", 0)).toThrow();
  });
});
