import { describe, expect, it } from "vitest";
import { SAVE_KEY, SAVE_VERSION, defaultSave, loadSave, migrate, resetSave, sanitize, writeSave, type KeyValueStore } from "../../src/persistence/save";

class MemStore implements KeyValueStore {
  m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.get(k) ?? null; }
  setItem(k: string, v: string): void { this.m.set(k, v); }
  removeItem(k: string): void { this.m.delete(k); }
}

describe("persistence", () => {
  it("starts new, round-trips, and resets", () => {
    const s = new MemStore();
    expect(loadSave(s).status).toBe("new");
    const d = defaultSave();
    d.campaign.completedStages = ["a"];
    d.settings.leftHanded = true;
    expect(writeSave(s, d)).toBe(true);
    const r = loadSave(s);
    expect(r.status).toBe("loaded");
    expect(r.data.campaign.completedStages).toEqual(["a"]);
    expect(r.data.settings.leftHanded).toBe(true);
    resetSave(s);
    expect(loadSave(s).status).toBe("new");
  });

  it("recovers from corrupt JSON and keeps a backup of the blob", () => {
    const s = new MemStore();
    s.setItem(SAVE_KEY, "{not json");
    const r = loadSave(s);
    expect(r.status).toBe("recovered");
    expect(s.getItem(`${SAVE_KEY}.corrupt`)).toBe("{not json");
  });

  it("recovers from a future/unknown version rather than guessing", () => {
    const s = new MemStore();
    s.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 5 }));
    expect(loadSave(s).status).toBe("recovered");
  });

  it("sanitizes hostile or out-of-range fields to defaults/clamps", () => {
    const out = sanitize({
      version: 1,
      settings: { arabicTextScale: 99, masterVolume: -3, difficulty: "nightmare", reducedMotion: "yes", controlScheme: "dpad" },
      campaign: { stageId: 42, completedStages: ["a", 7, "a"] },
      quests: { q: { completed: ["x", 1], flags: "bad" }, bad: 5 },
      lexicon: { w1: { state: "mastered", box: 99, due: 5 }, w2: { state: "cheating" } },
    });
    expect(out.settings.arabicTextScale).toBe(1.6);
    expect(out.settings.masterVolume).toBe(0);
    expect(out.settings.difficulty).toBe("standard");
    expect(out.settings.reducedMotion).toBe(false);
    expect(out.settings.controlScheme).toBe("dpad");
    expect(out.campaign.stageId).toBe(defaultSave().campaign.stageId);
    expect(out.campaign.completedStages).toEqual(["a"]);
    expect(out.quests).toEqual({ q: { completed: ["x"], flags: [] } });
    expect(Object.keys(out.lexicon)).toEqual(["w1"]);
    expect(out.lexicon.w1?.box).toBe(5);
  });

  it("respects the reduced-motion preference for fresh saves", () => {
    expect(defaultSave(true).settings.reducedMotion).toBe(true);
    expect(defaultSave(true).settings.screenShake).toBe(false);
  });

  it("migration machinery chains steps in order (test-only migrations)", () => {
    const migs = {
      0: (o: Record<string, unknown>) => ({ ...o, a: 1 }),
      1: (o: Record<string, unknown>) => ({ ...o, b: (o.a as number) + 1 }),
    };
    expect(migrate({ version: 0 }, migs, 2)).toEqual({ version: 2, a: 1, b: 2 });
    expect(migrate({ version: 0 }, { 0: migs[0] }, 2)).toBeNull(); // missing step => refuse
    expect(migrate({ version: "x" }, migs, 2)).toBeNull();
  });

  it("survives a throwing store", () => {
    const bad: KeyValueStore = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("x"); } };
    expect(loadSave(bad).status).toBe("recovered");
    expect(writeSave(bad, defaultSave())).toBe(false);
    expect(() => resetSave(bad)).not.toThrow();
  });
});
