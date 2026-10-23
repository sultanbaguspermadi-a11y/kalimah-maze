import { describe, expect, it } from "vitest";
import { pendingReview, validateReviewRecord, type ReviewRecord } from "../../src/content/review";

const dev = { mandatory: true, release: false };
const rel = { mandatory: true, release: true };
const reviewed = (): ReviewRecord => ({ ...pendingReview(), status: "reviewed", reviewedBy: "Reviewer A", reviewedOn: "2026-11-01", evidence: "signoff-001" });

describe("review record validation", () => {
  it("pending items warn in development and block in release", () => {
    expect(validateReviewRecord("c", pendingReview(), dev).map((i) => i.severity)).toEqual(["warning"]);
    expect(validateReviewRecord("c", pendingReview(), rel).map((i) => i.severity)).toEqual(["error"]);
  });

  it("'reviewed' needs reviewer, ISO date and evidence", () => {
    expect(validateReviewRecord("c", reviewed(), rel)).toEqual([]);
    const m = (r: ReviewRecord): string[] => validateReviewRecord("c", r, rel).map((i) => i.message);
    expect(m({ ...reviewed(), reviewedBy: null })).toContain("status 'reviewed' requires reviewedBy");
    expect(m({ ...reviewed(), reviewedOn: "yesterday" })).toContain("status 'reviewed' requires reviewedOn as YYYY-MM-DD");
    expect(m({ ...reviewed(), evidence: null }).some((x) => x.includes("requires evidence"))).toBe(true);
  });

  it("a pending item cannot carry reviewer fields (no half-approved states)", () => {
    const bad: ReviewRecord = { ...pendingReview(), reviewedBy: "X" };
    expect(validateReviewRecord("c", bad, dev).some((i) => i.severity === "error" && i.message.includes("must not carry"))).toBe(true);
  });

  it("disputes: unresolved blocks 'reviewed'; 'disputed' needs one; resolution fields travel together", () => {
    const d = { raisedOn: "2026-11-02", raisedBy: "Reviewer A", text: "answer key ambiguous", resolution: null, resolvedOn: null };
    expect(validateReviewRecord("c", { ...reviewed(), disputes: [d] }, rel).some((i) => i.message.includes("unresolved dispute"))).toBe(true);
    expect(validateReviewRecord("c", { ...pendingReview(), status: "disputed" }, dev).some((i) => i.message.includes("requires at least one"))).toBe(true);
    expect(validateReviewRecord("c", { ...reviewed(), disputes: [{ ...d, resolution: "fixed" }] }, rel).some((i) => i.message.includes("together"))).toBe(true);
    expect(validateReviewRecord("c", { ...reviewed(), disputes: [{ ...d, resolution: "fixed", resolvedOn: "2026-11-03" }] }, rel)).toEqual([]);
  });

  it("withdrawn items do not block release", () => {
    expect(validateReviewRecord("c", { ...pendingReview(), status: "withdrawn" }, rel)).toEqual([]);
  });
});
