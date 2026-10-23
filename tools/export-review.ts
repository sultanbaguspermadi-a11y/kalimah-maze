// Exports a self-contained packet for an independent Arabic reviewer: JSON (machine), CSV (spreadsheet), Markdown (reading).
// Usage: npm run export:review  ->  review-packet/
import { mkdirSync, writeFileSync } from "node:fs";
import { loadContentItems, loadSources, validateContentItems, type ContentItem } from "../src/content/items";

const OUT = "review-packet";
const items = loadContentItems();
const sources = loadSources();
const issues = validateContentItems(items, sources, true);
const generatedOn = new Date().toISOString().slice(0, 10);

const instructions = [
  "Reviewer instructions",
  "1. Check each item's Arabic (including harakat), meaning, answer key and explanation against a cited reference.",
  "2. Record your decision per item: verdict (approve | correct | dispute | reject), corrections (field, from, to, reason), notes.",
  "3. Cite every reference you used (title, author, edition, page/section). Do not approve an item you could not verify.",
  "4. Return the filled file. An item becomes 'reviewed' only when reviewer name, date and a sign-off reference are recorded in the repository.",
  "Current status of ALL items below: pending_review. Nothing here has been expert-reviewed.",
];

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/review-packet.json`, JSON.stringify({
  generatedOn, instructions, decisionTemplate: { verdict: "", corrections: [{ field: "", from: "", to: "", reason: "" }], notes: "", references: [""] },
  sources, items, openIssues: issues.map((i) => ({ severity: i.severity, where: i.where, message: i.message })),
}, null, 2) + "\n");

const q = (v: unknown): string => `"${String(Array.isArray(v) ? v.join(" | ") : v ?? "").replaceAll('"', '""')}"`;
const row = (it: ContentItem): string => [
  it.id, it.kind, it.fields.ar, it.fields.indonesian ?? it.fields.prompt, it.fields.options ?? "", it.fields.answer ?? "", it.fields.rationale ?? "",
  it.provenance.kind, it.provenance.sourceIds, it.review.status, "", "", "", "",
].map(q).join(",");
writeFileSync(`${OUT}/review-packet.csv`, "\uFEFF" + [
  ["id", "kind", "arabic", "indonesian_or_prompt", "options", "answer_key", "explanation", "provenance", "source_ids", "status", "REVIEWER_verdict", "REVIEWER_corrections", "REVIEWER_notes", "REVIEWER_references"].join(","),
  ...items.map(row),
].join("\n") + "\n");

const md: string[] = [`# Kalimah Maze — content review packet`, ``, `Generated ${generatedOn}. ${items.length} items, all \`pending_review\`.`, ``, ...instructions.map((l) => `> ${l}`), ``];
for (const it of items) {
  md.push(`## ${it.id} (${it.kind}${it.legacyId ? `, legacy ${it.legacyId}` : ""})`, ``);
  for (const [k, v] of Object.entries(it.fields)) md.push(`- **${k}:** ${Array.isArray(v) ? v.join(" / ") : v}`);
  md.push(`- **provenance:** ${it.provenance.kind} — ${it.provenance.note}`, `- **references:** ${it.provenance.sourceIds.join(", ") || "none recorded"}`, `- **status:** ${it.review.status}`, ``,
    `Verdict: [ ] approve  [ ] correct  [ ] dispute  [ ] reject`, `Corrections / notes / references:`, ``);
}
writeFileSync(`${OUT}/review-packet.md`, md.join("\n") + "\n");
console.log(`Wrote ${OUT}/ (${items.length} items, ${sources.length} sources, ${issues.length} open release issues)`);
