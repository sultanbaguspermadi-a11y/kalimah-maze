import lexData from "./data/legacy-lexicon.json";
import nahwuData from "./data/legacy-nahwu.json";
import sourceData from "./data/sources.json";
import type { ReviewStatus } from "../core/types";
import { pendingReview, validateReviewRecord, type ReviewRecord } from "./review";
import type { Issue } from "./validate";

export type ContentKind = "lexicon" | "nahwu";

export interface Provenance {
  kind: "legacy-prototype" | "authored-original" | "external-reference";
  file?: string;
  sha256?: string;
  note: string;
  /** Ids from sources.json that were actually consulted for this item. Empty = no linguistic reference recorded yet. */
  sourceIds: string[];
}

export interface SourceEntry {
  id: string;
  kind: "book" | "article" | "dictionary" | "website" | "other";
  title: string;
  author?: string; edition?: string; publisher?: string; year?: number; url?: string; accessedOn?: string;
  /** True only when someone has checked this item's content against the source. */
  verifiedAgainstContent: boolean;
  notes?: string;
}

export interface ContentItem {
  id: string; // stable, never reused
  kind: ContentKind;
  /** Mandatory items feed gates/bosses or answer keys. All current items are treated as mandatory (conservative). */
  mandatory: boolean;
  legacyId: string | null;
  fields: Record<string, string | number | string[]>;
  provenance: Provenance;
  review: ReviewRecord;
}

const STATUSES: readonly ReviewStatus[] = ["pending_review", "reviewed", "disputed", "withdrawn"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Strict parse: malformed review data throws instead of silently becoming "pending". */
export function parseReview(raw: unknown, where: string): ReviewRecord {
  if (!isObj(raw)) throw new Error(`${where}: review must be an object`);
  const status = STATUSES.find((s) => s === raw.status);
  if (!status) throw new Error(`${where}: unknown review status ${JSON.stringify(raw.status)}`);
  const list = (k: string): unknown[] => {
    const v = raw[k];
    if (!Array.isArray(v)) throw new Error(`${where}: review.${k} must be an array`);
    return v;
  };
  const base = pendingReview();
  return {
    ...base, status,
    reviewedBy: str(raw.reviewedBy), reviewedOn: str(raw.reviewedOn), evidence: str(raw.evidence),
    notes: list("notes") as ReviewRecord["notes"],
    corrections: list("corrections") as ReviewRecord["corrections"],
    disputes: list("disputes") as ReviewRecord["disputes"],
  };
}

function parseProvenance(raw: unknown, where: string): Provenance {
  if (!isObj(raw)) throw new Error(`${where}: provenance must be an object`);
  const kind = (["legacy-prototype", "authored-original", "external-reference"] as const).find((k) => k === raw.kind);
  if (!kind) throw new Error(`${where}: unknown provenance kind`);
  return {
    kind, note: str(raw.note) ?? "", sourceIds: Array.isArray(raw.sourceIds) ? raw.sourceIds.filter((x): x is string => typeof x === "string") : [],
    ...(str(raw.file) ? { file: str(raw.file) as string } : {}), ...(str(raw.sha256) ? { sha256: str(raw.sha256) as string } : {}),
  };
}

export function loadContentItems(): ContentItem[] {
  const items: ContentItem[] = [];
  for (const e of lexData.entries) {
    items.push({
      id: e.newId, kind: "lexicon", mandatory: true, legacyId: e.legacyId,
      fields: { ar: e.ar, indonesian: e.id, zone: e.zone },
      provenance: parseProvenance(e.provenance, e.newId), review: parseReview(e.review, e.newId),
    });
  }
  for (const q of nahwuData.entries) {
    items.push({
      id: q.newId, kind: "nahwu", mandatory: true, legacyId: q.legacyId,
      fields: { tier: q.tier, topic: q.topic, ar: q.ar, prompt: q.prompt, options: q.options, answer: q.answer, rationale: q.rationale },
      provenance: parseProvenance(q.provenance, q.newId), review: parseReview(q.review, q.newId),
    });
  }
  return items;
}

export const loadSources = (): SourceEntry[] => sourceData.sources as SourceEntry[];

const ARABIC = /[\u0600-\u06FF]/;

export function validateContentItems(items: readonly ContentItem[], sources: readonly SourceEntry[], release: boolean): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string): void => { issues.push({ severity: "error", where, message }); };
  const sourceIds = new Set(sources.map((s) => s.id));
  if (sourceIds.size !== sources.length) err("sources", "duplicate source id");
  const seen = new Set<string>();

  for (const it of items) {
    if (seen.has(it.id)) err(it.id, "duplicate content id");
    seen.add(it.id);
    for (const sid of it.provenance.sourceIds) if (!sourceIds.has(sid)) err(it.id, `unknown source id "${sid}"`);
    if (it.provenance.sourceIds.length === 0) {
      issues.push({ severity: release ? "error" : "warning", where: it.id, message: "no linguistic reference recorded" });
    }
    const f = it.fields;
    if (it.kind === "lexicon") {
      if (typeof f.ar !== "string" || !ARABIC.test(f.ar)) err(it.id, "Arabic form missing or not Arabic script");
      if (typeof f.indonesian !== "string" || !f.indonesian.trim()) err(it.id, "Indonesian gloss missing");
    } else {
      const opts = Array.isArray(f.options) ? f.options : [];
      if (typeof f.prompt !== "string" || !f.prompt.trim()) err(it.id, "prompt missing");
      if (opts.length < 2) err(it.id, "needs at least two options");
      if (new Set(opts).size !== opts.length) err(it.id, "duplicate options");
      if (typeof f.answer !== "string" || !opts.includes(f.answer)) err(it.id, "answer key is not one of the options");
      if (typeof f.rationale !== "string" || !f.rationale.trim()) err(it.id, "explanation missing");
    }
    issues.push(...validateReviewRecord(it.id, it.review, { mandatory: it.mandatory, release }));
  }
  return issues;
}
