import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { db as Db } from "@/db";
import { organizations, sessions } from "@/db/schema";
import { deverrouillerSessionId, signalerPresence, verrouillerSessionId } from "@/lib/auth/session";
import { newId } from "@/lib/ids";

import { ouvrirBaseDeTest, semerEntreprise } from "./base";

let db: typeof Db;
let fermer: () => Promise<void>;
let user: string;
let org: string;

beforeAll(async () => {
  ({ db, fermer } = await ouvrirBaseDeTest());
  ({ userId: user, organizationId: org } = await semerEntreprise(db));
});
afterAll(async () => fermer());

async function nouvelleSession(derniereActivite = new Date()) {
  const id = newId();
  await db.insert(sessions).values({
    id,
    userId: user,
    organizationId: org,
    tokenHash: id,
    expiresAt: new Date(Date.now() + 86_400_000),
    lastSeenAt: derniereActivite,
  });
  return id;
}

const etat = async (id: string) => (await db.select().from(sessions).where(eq(sessions.id, id)))[0];

describe("verrou de session en base", () => {
  it("le délai par défaut est de dix minutes, et la base refuse un délai absurde", async () => {
    const [o] = await db.select({ d: organizations.delaiVerrouillageMinutes }).from(organizations).where(eq(organizations.id, org));
    expect(o.d).toBe(10);
    await expect(db.update(organizations).set({ delaiVerrouillageMinutes: 0 }).where(eq(organizations.id, org))).rejects.toThrow();
  });

  it("un signe de vie entretient une session active", async () => {
    const id = await nouvelleSession(new Date(Date.now() - 5 * 60_000));
    expect(await signalerPresence(id, 10)).toBe(true);
    const s = await etat(id);
    expect(Date.now() - s.lastSeenAt.getTime()).toBeLessThan(5_000);
    expect(s.verrouilleeLe).toBeNull();
  });

  it("un signe de vie ne rouvre JAMAIS une session éteinte : il la verrouille", async () => {
    const id = await nouvelleSession(new Date(Date.now() - 60 * 60_000));
    expect(await signalerPresence(id, 10)).toBe(false);
    expect((await etat(id)).verrouilleeLe).not.toBeNull();
    // Même un second signe de vie ne la rouvre pas.
    expect(await signalerPresence(id, 10)).toBe(false);
  });

  it("une session voilée le reste malgré l'activité, jusqu'au déverrouillage", async () => {
    const id = await nouvelleSession();
    await verrouillerSessionId(id);
    const premiere = (await etat(id)).verrouilleeLe;
    await verrouillerSessionId(id);
    // La première heure de verrou reste.
    expect((await etat(id)).verrouilleeLe?.getTime()).toBe(premiere?.getTime());
    expect(await signalerPresence(id, 10)).toBe(false);

    await deverrouillerSessionId(id);
    expect((await etat(id)).verrouilleeLe).toBeNull();
    expect(await signalerPresence(id, 10)).toBe(true);
  });
});
