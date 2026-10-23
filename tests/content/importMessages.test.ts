import { describe, expect, it } from "vitest";
import { describeImport } from "../../src/ui/importMessages";

describe("describeImport", () => {
  it("never claims success for failures and always reassures that data is unchanged", () => {
    expect(describeImport({ status: "unusable", reason: "not valid JSON" })).toEqual({ ok: false, text: expect.stringContaining("Tidak ada yang diubah") });
    expect(describeImport({ status: "failed", reason: "x" }).ok).toBe(false);
    expect(describeImport({ status: "absent" }).ok).toBe(false);
  });
  it("reports counts and dropped entries on success", () => {
    const r = describeImport({ status: "imported", summary: { lexiconEntries: 3, discoveredWords: 4, nahwuEntries: 2, bestScores: 1, settingsApplied: [] }, dropped: [{ kind: "word", id: "x", reason: "r" }] });
    expect(r.ok).toBe(true);
    expect(r.text).toContain("4 kata");
    expect(r.text).toContain("1 entri tidak dapat dibawa");
  });
});
