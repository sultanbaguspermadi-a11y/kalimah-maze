import { describe, expect, it } from "vitest";
import { loadContentItems, loadSources, parseReview, validateContentItems, type ContentItem } from "../../src/content/items";
import { LEGACY_NAHWU_IDS, LEGACY_WORD_IDS } from "../../src/persistence/legacyMigration";

const items = loadContentItems();

describe("legacy content seed", () => {
  it("contains all 24 words and 15 nahwu questions, with unique stable ids matching the migration map", () => {
    expect(items.filter((i) => i.kind === "lexicon")).toHaveLength(24);
    expect(items.filter((i) => i.kind === "nahwu")).toHaveLength(15);
    expect(new Set(items.map((i) => i.id)).size).toBe(39);
    expect(Object.values(LEGACY_WORD_IDS).sort()).toEqual(items.filter((i) => i.kind === "lexicon").map((i) => i.id).sort());
    expect(Object.values(LEGACY_NAHWU_IDS).sort()).toEqual(items.filter((i) => i.kind === "nahwu").map((i) => i.id).sort());
  });

  it("every item is pending_review: nothing is claimed as expert-reviewed", () => {
    expect(items.every((i) => i.review.status === "pending_review" && i.review.reviewedBy === null && i.review.evidence === null)).toBe(true);
  });

  it("passes structural checks (answer in options, unique options, explanation present)", () => {
    const errors = validateContentItems(items, loadSources(), false).filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("development mode only warns; the RELEASE gate blocks on every unreviewed / unreferenced item (KM-062, KM-114)", () => {
    const dev = validateContentItems(items, loadSources(), false);
    expect(dev.some((i) => i.severity === "error")).toBe(false);
    expect(dev.filter((i) => i.severity === "warning").length).toBeGreaterThanOrEqual(39);
    const rel = validateContentItems(items, loadSources(), true).filter((i) => i.severity === "error");
    expect(rel.length).toBeGreaterThanOrEqual(78); // 39 x (not reviewed + no reference)
  });
});

describe("validateContentItems", () => {
  const base = (): ContentItem => structuredClone(items.find((i) => i.kind === "nahwu") as ContentItem);

  it("rejects a wrong answer key, duplicate options and unknown sources", () => {
    const a = base(); a.fields.answer = "not an option";
    const b = base(); b.fields.options = ["x", "x"]; b.fields.answer = "x";
    const c = base(); c.provenance.sourceIds = ["ghost"];
    const m = (it: ContentItem): string[] => validateContentItems([it], [], false).map((i) => i.message);
    expect(m(a)).toContain("answer key is not one of the options");
    expect(m(b)).toContain("duplicate options");
    expect(m(c)).toContain('unknown source id "ghost"');
  });

  it("a fully evidenced, referenced item passes the release gate", () => {
    const it = base();
    it.provenance.sourceIds = ["src-1"];
    it.review = { ...it.review, status: "reviewed", reviewedBy: "Reviewer A", reviewedOn: "2026-11-01", evidence: "signoff-001" };
    const src = [{ id: "src-1", kind: "book" as const, title: "Placeholder title for test", verifiedAgainstContent: true }];
    expect(validateContentItems([it], src, true)).toEqual([]);
  });

  it("parseReview refuses malformed data instead of defaulting to a safe-looking status", () => {
    expect(() => parseReview({ status: "approved" }, "x")).toThrow(/unknown review status/);
    expect(() => parseReview({ status: "pending_review" }, "x")).toThrow(/must be an array/);
    expect(() => parseReview(null, "x")).toThrow();
  });
});
