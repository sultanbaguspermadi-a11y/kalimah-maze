import { describe, expect, it } from "vitest";
import { MAX_IMPORT_CHARS, PRE_IMPORT_BACKUP_KEY, exportSave, importFromText, sameSave } from "../../src/persistence/importExport";
import { LEGACY_KEY, importLegacyFromStorage } from "../../src/persistence/legacyMigration";
import { SAVE_KEY, defaultSave, loadSave } from "../../src/persistence/save";
import { MemStore, legacyText } from "./helpers";

const NOW = new Date("2026-10-22T12:00:00.000Z");

describe("JSON export / import fallback", () => {
  it("round-trips an export into a fresh browser profile", () => {
    const a = new MemStore();
    a.m.set(LEGACY_KEY, legacyText());
    importLegacyFromStorage(a, NOW);
    const exported = exportSave(loadSave(a).data, NOW);

    const b = new MemStore(); // different origin / browser: no legacy key, no save
    expect(importFromText(b, exported, "file", NOW)).toEqual({ status: "restored" });
    expect(sameSave(loadSave(b).data, loadSave(a).data)).toBe(true);
  });

  it("restoring over an existing save keeps the previous bytes in a backup key", () => {
    const store = new MemStore();
    const prev = JSON.stringify(defaultSave());
    store.m.set(SAVE_KEY, prev);
    const other = defaultSave(); other.campaign.completedStages = ["s1"];
    expect(importFromText(store, exportSave(other, NOW), "file", NOW).status).toBe("restored");
    expect(store.getItem(PRE_IMPORT_BACKUP_KEY)).toBe(prev);
    expect(loadSave(store).data.campaign.completedStages).toEqual(["s1"]);
  });

  it("imports the RAW prototype blob (copied from the old browser) by paste or file, without needing its origin", () => {
    const store = new MemStore();
    const r = importFromText(store, legacyText(), "paste", NOW);
    expect(r.status).toBe("legacy-imported");
    expect(loadSave(store).data.legacy?.imports[0]?.source).toBe("paste");
    expect(importFromText(store, legacyText(), "paste", NOW).status).toBe("already-imported");
  });

  it("tolerates a UTF-8 BOM (files saved by some editors)", () => {
    const store = new MemStore();
    expect(importFromText(store, `\uFEFF${legacyText()}`, "file", NOW).status).toBe("legacy-imported");
  });

  it("accepts a bare new-format save and upgrades an older version", () => {
    const store = new MemStore();
    const bare = { version: 1, settings: { leftHanded: true }, campaign: { stageId: "x", checkpoint: null, completedStages: [] }, quests: {}, lexicon: {} };
    expect(importFromText(store, JSON.stringify(bare), "file", NOW).status).toBe("restored");
    expect(loadSave(store).data.settings.leftHanded).toBe(true);
  });

  it.each([
    ["garbage", "hello"],
    ["json array", "[]"],
    ["unknown object", JSON.stringify({ foo: 1 })],
    ["future export version", JSON.stringify({ format: "kalimah-maze-save", exportVersion: 99, save: {} })],
    ["export without save", JSON.stringify({ format: "kalimah-maze-save", exportVersion: 1 })],
    ["future save version", JSON.stringify({ version: 99, settings: {} })],
    ["oversized", " ".repeat(MAX_IMPORT_CHARS + 1)],
  ])("%s -> unusable and nothing is written", (_n, text) => {
    const store = new MemStore();
    expect(importFromText(store, text, "file", NOW).status).toBe("unusable");
    expect(store.writes).toEqual([]);
  });

  it("failed restore leaves the existing save intact", () => {
    const store = new MemStore();
    const prev = JSON.stringify(defaultSave());
    store.m.set(SAVE_KEY, prev);
    store.failWriteFor = SAVE_KEY;
    const r = importFromText(store, exportSave(defaultSave(), NOW), "file", NOW);
    expect(r.status).toBe("failed");
    expect(store.getItem(SAVE_KEY)).toBe(prev);
  });
});
