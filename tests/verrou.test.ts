import { describe, expect, it } from "vitest";

import {
  DELAIS_VERROUILLAGE,
  MARGE_SERVEUR_MINUTES,
  delaiValide,
  inactiviteEcoulee,
  sessionVerrouillee,
} from "@/lib/auth/verrou";

const MINUTE = 60_000;
const maintenant = new Date("2026-10-06T10:00:00Z");
const ilYa = (minutes: number) => new Date(maintenant.getTime() - minutes * MINUTE);

describe("verrouillage d'une session inactive", () => {
  it("un verrou inscrit l'emporte sur une activité récente", () => {
    expect(sessionVerrouillee({ verrouilleeLe: ilYa(1), derniereActivite: maintenant, delaiMinutes: 10, maintenant })).toBe(true);
  });

  it("le serveur attend le délai ET sa marge avant de juger la session éteinte", () => {
    const etat = (minutes: number) =>
      sessionVerrouillee({ verrouilleeLe: null, derniereActivite: ilYa(minutes), delaiMinutes: 10, maintenant });
    // Le navigateur ne signale qu'une fois par minute : à 11 minutes, la
    // personne a pu travailler jusqu'à la dixième sans que le serveur le sache.
    expect(etat(10)).toBe(false);
    expect(etat(10 + MARGE_SERVEUR_MINUTES)).toBe(false);
    expect(etat(10 + MARGE_SERVEUR_MINUTES + 0.1)).toBe(true);
    expect(etat(180)).toBe(true);
  });

  it("le délai de l'entreprise s'applique", () => {
    const derniereActivite = ilYa(20);
    expect(sessionVerrouillee({ verrouilleeLe: null, derniereActivite, delaiMinutes: 30, maintenant })).toBe(false);
    expect(sessionVerrouillee({ verrouilleeLe: null, derniereActivite, delaiMinutes: 15, maintenant })).toBe(true);
  });

  it("le navigateur voile à l'heure exacte, pas une seconde plus tôt", () => {
    const t = maintenant.getTime();
    expect(inactiviteEcoulee(t - 10 * MINUTE + 1, t, 10)).toBe(false);
    expect(inactiviteEcoulee(t - 10 * MINUTE, t, 10)).toBe(true);
  });

  it("seuls les délais proposés s'enregistrent", () => {
    for (const d of DELAIS_VERROUILLAGE) expect(delaiValide(d)).toBe(true);
    expect(delaiValide(0)).toBe(false);
    expect(delaiValide(7)).toBe(false);
    expect(delaiValide(-10)).toBe(false);
  });
});
