import { describe, expect, it } from "vitest";
import { validateReview } from "../../src/content/validate";

describe("review status validation", () => {
  it("rejects 'reviewed' without reviewer and date", () => {
    const i = validateReview("c1", { reviewStatus: "reviewed" }, false, false);
    expect(i[0]?.severity).toBe("error");
  });
  it("accepts a fully attributed review", () => {
    expect(validateReview("c1", { reviewStatus: "reviewed", reviewedBy: "Reviewer A", reviewedOn: "2026-10-22" }, true, true)).toEqual([]);
  });
  it("mandatory unreviewed items warn in dev and error in release", () => {
    expect(validateReview("c2", { reviewStatus: "unreviewed" }, true, false)[0]?.severity).toBe("warning");
    expect(validateReview("c2", { reviewStatus: "unreviewed" }, true, true)[0]?.severity).toBe("error");
  });
});
