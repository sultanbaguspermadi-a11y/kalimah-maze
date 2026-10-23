import { describe, expect, it } from "vitest";
import { LEGACY_KEY, LEGACY_WORD_IDS, hashText, importLegacyFromStorage, importLegacyText, mergeLegacy, parseLegacy, retireLegacy } from "../../src/persistence/legacyMigration";
import { SAVE_KEY, defaultSave, loadSave } from "../../src/persistence/save";
import { MemStore, legacyText } from "./helpers";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const withLegacy = (text: string): MemStore => { const s = new MemStore(); s.m.set(LEGACY_KEY, text); return s; };

describe("successful migration", () => {
  it("imports vocabulary, statistics, scores, settings, difficulty, mode and theme", () => {
    const text = legacyText();
    const store = withLegacy(text);
    const r = importLegacyFromStorage(store, NOW);
    expect(r.status).toBe("imported");
    const { data, status } = loadSave(store);
    expect(status).toBe("loaded");

    // vocabulary + review statistics (ids translated through the frozen map)
    expect(data.lexiconStats[LEGACY_WORD_IDS.w0 as string]).toEqual({ ok: 4, no: 1, dirs: 3, rounds: ["r1", "r2", "r3"], last: 1_700_000_000_000 });
    expect(data.lexicon[LEGACY_WORD_IDS.w1 as string]?.state).toBe("practised");
    expect(data.lexicon[LEGACY_WORD_IDS.w2 as string]?.state).toBe("discovered");
    expect(data.lexicon[LEGACY_WORD_IDS.w6 as string]?.state).toBe("reverse");
    // prototype "Mastered" is mapped conservatively but remembered
    expect(data.lexicon[LEGACY_WORD_IDS.w0 as string]?.state).toBe("reverse");
    expect(data.legacy?.legacyMastered).toEqual([LEGACY_WORD_IDS.w0]);
    expect(data.legacy?.discovered).toHaveLength(4);
    // nahwu question statistics
    expect(data.nahwuStats["nq-n1"]).toEqual({ ok: 3, no: 1, last: 1_700_000_300_000 });
    expect(data.nahwuStats["nq-n9"]?.no).toBe(2);
    // best scores, difficulty/mode/theme preferences
    expect(data.legacy?.bestScores).toEqual({ "normal/adv": 1200, "hard/nahwu": 800 });
    expect(data.legacy?.preferences).toEqual({ difficulty: "tricky", mode: "nahwu", zoneTheme: "tech" });
    // settings
    expect(data.settings).toMatchObject({
      language: "en", masterVolume: 0.7, musicVolume: 0.4, sfxVolume: 0.9, muted: true, sfxEnabled: true, musicEnabled: false,
      reducedMotion: true, screenShake: false, arabicTextScale: 1.3, controlScheme: "swipe", theme: "dark", showTranslation: false, leftHanded: true,
      difficulty: "standard", // tricky -> standard (lossy; original kept in legacy.preferences)
    });
    expect(data.legacy?.imports).toEqual([{ sourceHash: hashText(text), importedAt: NOW.toISOString(), legacyVersion: 2, source: "localStorage" }]);
  });

  it("never writes to or deletes the legacy key", () => {
    const text = legacyText();
    const store = withLegacy(text);
    importLegacyFromStorage(store, NOW);
    expect(store.getItem(LEGACY_KEY)).toBe(text);
    expect(store.writes).not.toContain(LEGACY_KEY);
    expect(store.removes).not.toContain(LEGACY_KEY);
  });

  it("accepts schema v:1 the same way the prototype does", () => {
    const store = withLegacy(legacyText({ v: 1 }));
    expect(importLegacyFromStorage(store, NOW).status).toBe("imported");
    expect(loadSave(store).data.legacy?.imports[0]?.legacyVersion).toBe(1);
  });

  it("reports nothing to import when the legacy key is absent (e.g. different origin) and writes nothing", () => {
    const store = new MemStore();
    expect(importLegacyFromStorage(store, NOW)).toEqual({ status: "absent" });
    expect(store.writes).toEqual([]);
  });
});

describe("repeat migration is idempotent", () => {
  it("second import of the same data is a no-op (bytes unchanged)", () => {
    const store = withLegacy(legacyText());
    expect(importLegacyFromStorage(store, NOW).status).toBe("imported");
    const before = store.getItem(SAVE_KEY);
    const writesBefore = store.writes.length;
    expect(importLegacyFromStorage(store, new Date("2027-01-01T00:00:00Z")).status).toBe("already-imported");
    expect(store.getItem(SAVE_KEY)).toBe(before);
    expect(store.writes.length).toBe(writesBefore);
  });

  it("the merge itself is idempotent even if the hash guard were bypassed", () => {
    const p = parseLegacy(legacyText());
    if (p.status !== "ok") throw new Error("fixture must parse");
    const once = mergeLegacy(defaultSave(), p.data, "h1", "file", NOW).data;
    const twice = mergeLegacy(once, p.data, "h2", "file", NOW).data;
    expect({ ...twice, legacy: { ...twice.legacy, imports: [] } }).toEqual({ ...once, legacy: { ...once.legacy, imports: [] } });
  });

  it("a changed legacy save merges by max without downgrading new progress or overwriting settings", () => {
    const store = withLegacy(legacyText());
    importLegacyFromStorage(store, NOW);
    const cur = loadSave(store).data;
    const w1 = LEGACY_WORD_IDS.w1 as string;
    cur.lexicon[w1] = { state: "contextual", box: 4, due: 5 }; // player advanced in the NEW game
    cur.settings.leftHanded = false;                           // and changed a setting
    store.setItem(SAVE_KEY, JSON.stringify(cur));

    store.m.set(LEGACY_KEY, legacyText({ best: { "normal/adv": 900, "chill/hunt": 50 }, lex: { w1: { ok: 9, no: 0, dirs: 3, rounds: ["r9"], last: 1_800_000_000_000 } } }));
    expect(importLegacyFromStorage(store, new Date("2026-12-01T00:00:00Z")).status).toBe("imported");
    const after = loadSave(store).data;
    expect(after.lexicon[w1]?.state).toBe("contextual");                       // not downgraded
    expect(after.lexiconStats[w1]).toMatchObject({ ok: 9, dirs: 3 });          // stats merged by max / OR
    expect(after.lexiconStats[w1]?.rounds).toEqual(["r1", "r9"]);              // ordered union
    expect(after.legacy?.bestScores).toEqual({ "normal/adv": 1200, "hard/nahwu": 800, "chill/hunt": 50 });
    expect(after.settings.leftHanded).toBe(false);                             // settings only applied on first import
    expect(after.legacy?.imports).toHaveLength(2);
  });
});

describe("corrupt, incompatible and partial legacy data", () => {
  it.each([
    ["invalid JSON", "{not json"],
    ["JSON null", "null"],
    ["JSON array", "[1,2]"],
    ["unknown version", JSON.stringify({ v: 3 })],
    ["missing version", JSON.stringify({ lex: {} })],
  ])("%s -> unusable, nothing written, legacy untouched", (_n, text) => {
    const store = withLegacy(text);
    const r = importLegacyFromStorage(store, NOW);
    expect(r.status).toBe("unusable");
    expect(store.writes).toEqual([]);
    expect(store.getItem(LEGACY_KEY)).toBe(text);
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it("imports what is valid from a partial/malformed save and reports what it dropped", () => {
    const store = withLegacy(legacyText({
      lex: { w0: { ok: -5, no: "7", dirs: 99, rounds: ["a", 1, null, "b", "c", "d", "e", "f", "g"], last: "x" }, wBOGUS: { ok: 1 }, w1: "oops" },
      words: ["w0", "w0", "nope", 5],
      nq: { n1: { ok: 2 }, zzz: { ok: 1 }, n2: 7 },
      best: { "normal/adv": 100, "weird/key": 5, "hard/hunt": -3, "chill/adv": "9" },
      set: { lang: "fr", vm: 500, vmu: "loud", mt: 7, rm: 1, ar: 9, ctl: "tilt", th: "sepia" },
      diff: "impossible", mode: "arcade", theme: "moon",
    }));
    const r = importLegacyFromStorage(store, NOW);
    if (r.status !== "imported") throw new Error(JSON.stringify(r));
    const d = loadSave(store).data;
    const w0 = d.lexiconStats[LEGACY_WORD_IDS.w0 as string];
    // ok:-5 -> 0, no:"7" -> 7, dirs:99 -> 99&3 = 3, non-strings dropped from rounds then last 6 kept, last:"x" -> 0
    expect(w0).toEqual({ ok: 0, no: 7, dirs: 3, rounds: ["b", "c", "d", "e", "f", "g"], last: 0 });
    expect(d.legacy?.discovered).toEqual([LEGACY_WORD_IDS.w0]);                // deduped, unknown ids gone
    expect(d.nahwuStats["nq-n1"]).toEqual({ ok: 2, no: 0, last: 0 });
    expect(Object.keys(d.nahwuStats)).toEqual(["nq-n1"]);
    expect(d.legacy?.bestScores).toEqual({ "normal/adv": 100 });
    expect(d.settings.language).toBe("id");                                    // invalid -> default
    expect(d.settings.masterVolume).toBe(1);                                   // clamped to 100%
    expect(d.settings.reducedMotion).toBe(true);                               // valid keys still applied
    expect(d.settings.theme).toBe("auto");
    expect(d.legacy?.preferences).toEqual({ difficulty: null, mode: null, zoneTheme: null });
    const kinds = r.dropped.map((x) => `${x.kind}:${x.id}`);
    expect(kinds).toEqual(expect.arrayContaining(["lexicon:wBOGUS", "lexicon:w1", "word:nope", "word:5", "nahwu:zzz", "nahwu:n2", "best:weird/key", "best:hard/hunt", "best:chill/adv", "setting:lang", "setting:vmu", "setting:mt", "setting:ar", "setting:ctl", "setting:th"]));
  });

  it("an entirely empty object with a valid version imports cleanly as 'nothing to carry over'", () => {
    const store = withLegacy(JSON.stringify({ v: 2 }));
    expect(importLegacyFromStorage(store, NOW).status).toBe("imported");
    const d = loadSave(store).data;
    expect(d.lexiconStats).toEqual({});
    expect(d.settings).toEqual(defaultSave().settings);
  });
});

describe("recovery", () => {
  it("a corrupt NEW save is backed up, then the legacy data is imported", () => {
    const store = withLegacy(legacyText());
    store.m.set(SAVE_KEY, "{broken");
    expect(importLegacyFromStorage(store, NOW).status).toBe("imported");
    expect(store.getItem(`${SAVE_KEY}.corrupt`)).toBe("{broken");
    expect(loadSave(store).status).toBe("loaded");
  });

  it("storage write failure -> failed, previous save intact, legacy intact, no partial state", () => {
    const text = legacyText();
    const store = withLegacy(text);
    const prev = JSON.stringify(defaultSave());
    store.m.set(SAVE_KEY, prev);
    store.failWriteFor = SAVE_KEY;
    const r = importLegacyFromStorage(store, NOW);
    expect(r.status).toBe("failed");
    expect(store.getItem(SAVE_KEY)).toBe(prev);
    expect(store.getItem(LEGACY_KEY)).toBe(text);
  });

  it("read-back mismatch -> failed and the previous save bytes are restored", () => {
    const store = withLegacy(legacyText());
    const prev = JSON.stringify(defaultSave());
    store.m.set(SAVE_KEY, prev);
    store.mangleWriteFor = SAVE_KEY;
    const r = importLegacyFromStorage(store, NOW);
    expect(r.status).toBe("failed");
    expect(store.getItem(SAVE_KEY)).toBe(prev);
  });

  it("read-back mismatch with no previous save removes the broken write", () => {
    const store = withLegacy(legacyText());
    store.mangleWriteFor = SAVE_KEY;
    expect(importLegacyFromStorage(store, NOW).status).toBe("failed");
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it("inaccessible storage is reported, not thrown", () => {
    const bad = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
    expect(importLegacyFromStorage(bad, NOW)).toEqual({ status: "failed", reason: "browser storage is not accessible" });
  });
});

describe("retireLegacy (explicit, never automatic)", () => {
  it("refuses when nothing was imported, or the legacy data changed after import; removes only after a verified import", () => {
    const store = withLegacy(legacyText());
    expect(retireLegacy(store).status).toBe("refused");
    importLegacyFromStorage(store, NOW);
    store.m.set(LEGACY_KEY, legacyText({ best: { "hard/adv": 1 } }));
    expect(retireLegacy(store).status).toBe("refused");
    store.m.set(LEGACY_KEY, legacyText());
    expect(retireLegacy(store).status).toBe("removed");
    expect(store.getItem(LEGACY_KEY)).toBeNull();
    expect(retireLegacy(store).status).toBe("absent");
  });
});
