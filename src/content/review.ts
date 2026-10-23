import type { ReviewStatus } from "../core/types";
import type { Issue } from "./validate";

export interface ReviewNote { date: string; by: string; text: string }
export interface ReviewCorrection { date: string; by: string; field: string; from: string; to: string; reason: string }
export interface ReviewDispute { raisedOn: string; raisedBy: string; text: string; resolution: string | null; resolvedOn: string | null }

/** Full review trail for one content item. Nothing here is ever inferred or auto-filled. */
export interface ReviewRecord {
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedOn: string | null; // ISO date
  /** Pointer to documented sign-off (document id, ticket, signed form). Required for `reviewed`. */
  evidence: string | null;
  notes: ReviewNote[];
  corrections: ReviewCorrection[];
  disputes: ReviewDispute[];
}

export const pendingReview = (): ReviewRecord => ({
  status: "pending_review", reviewedBy: null, reviewedOn: null, evidence: null, notes: [], corrections: [], disputes: [],
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ReviewCheckOptions { mandatory: boolean; release: boolean }

/**
 * Enforces that review status always matches its evidence (PRD §20.6).
 * `release` mode is the public-release gate (KM-062 / KM-114): anything not `reviewed` is a blocking error.
 */
export function validateReviewRecord(id: string, r: ReviewRecord, opts: ReviewCheckOptions): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string): void => { issues.push({ severity: "error", where: id, message }); };
  const open = r.disputes.filter((d) => d.resolution === null);

  if (r.status === "reviewed") {
    if (!r.reviewedBy) err("status 'reviewed' requires reviewedBy");
    if (!r.reviewedOn || !ISO_DATE.test(r.reviewedOn)) err("status 'reviewed' requires reviewedOn as YYYY-MM-DD");
    if (!r.evidence) err("status 'reviewed' requires evidence (reference to documented sign-off)");
    if (open.length) err(`status 'reviewed' with ${open.length} unresolved dispute(s)`);
  } else {
    if (r.reviewedBy || r.reviewedOn || r.evidence) err(`status '${r.status}' must not carry reviewedBy/reviewedOn/evidence`);
  }
  if (r.status === "disputed" && open.length === 0) err("status 'disputed' requires at least one unresolved dispute");
  for (const d of r.disputes) {
    if ((d.resolution === null) !== (d.resolvedOn === null)) err("dispute must set resolution and resolvedOn together");
  }
  if (r.status !== "reviewed" && r.status !== "withdrawn") {
    issues.push({
      severity: opts.release ? "error" : "warning",
      where: id,
      message: `not expert-reviewed (status '${r.status}')${opts.mandatory ? " — mandatory item" : ""}`,
    });
  }
  return issues;
}
