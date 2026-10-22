import type { QuestDef, StageDef, ReviewStatus } from "../core/types";

export interface Issue { severity: "error" | "warning"; where: string; message: string }

export function validateQuest(q: QuestDef): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set<string>();
  for (const o of q.objectives) {
    if (ids.has(o.id)) issues.push({ severity: "error", where: `${q.id}/${o.id}`, message: "duplicate objective id" });
    ids.add(o.id);
  }
  for (const o of q.objectives) {
    for (const r of o.requires ?? []) {
      if (!ids.has(r)) issues.push({ severity: "error", where: `${q.id}/${o.id}`, message: `unknown prerequisite "${r}"` });
      if (r === o.id) issues.push({ severity: "error", where: `${q.id}/${o.id}`, message: "objective requires itself" });
    }
  }
  if (hasCycle(q)) issues.push({ severity: "error", where: q.id, message: "prerequisite cycle" });
  if (!q.objectives.some((o) => !o.optional)) issues.push({ severity: "error", where: q.id, message: "no mandatory objective" });
  return issues;
}

function hasCycle(q: QuestDef): boolean {
  const deps = new Map(q.objectives.map((o) => [o.id, o.requires ?? []]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    for (const d of deps.get(id) ?? []) if (deps.has(d) && visit(d)) return true;
    state.set(id, 2);
    return false;
  };
  return [...deps.keys()].some(visit);
}

export function validateStageShape(s: StageDef): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string): void => { issues.push({ severity: "error", where: s.id, message }); };
  if (s.rows.length !== s.height) err(`rows (${s.rows.length}) != height (${s.height})`);
  s.rows.forEach((r, y) => { if (r.length !== s.width) err(`row ${y} length ${r.length} != width ${s.width}`); });
  const tileIds = new Set(s.tiles.map((t) => t.id));
  for (const [ch, id] of Object.entries(s.legend)) if (!tileIds.has(id)) err(`legend "${ch}" -> unknown tile "${id}"`);
  s.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (!(ch in s.legend)) err(`unmapped char "${ch}" at ${x},${y}`); }));
  const seen = new Set<string>();
  for (const i of s.interactables) {
    if (seen.has(i.id)) err(`duplicate interactable id "${i.id}"`);
    seen.add(i.id);
  }
  for (const p of s.flagProducers) if (!seen.has(p.by)) err(`flag "${p.flag}" produced by unknown interactable "${p.by}"`);
  return issues;
}

export interface ReviewMeta { reviewStatus: ReviewStatus; reviewedBy?: string; reviewedOn?: string }

/** Rejects `reviewed` without a named reviewer and date (PRD §20.6: never fabricate review status). */
export function validateReview(id: string, m: ReviewMeta, mandatory: boolean, release: boolean): Issue[] {
  const issues: Issue[] = [];
  if (m.reviewStatus === "reviewed" && (!m.reviewedBy || !m.reviewedOn)) {
    issues.push({ severity: "error", where: id, message: "status 'reviewed' requires reviewedBy and reviewedOn" });
  }
  if (mandatory && m.reviewStatus !== "reviewed") {
    issues.push({ severity: release ? "error" : "warning", where: id, message: "mandatory item is not expert-reviewed" });
  }
  return issues;
}
