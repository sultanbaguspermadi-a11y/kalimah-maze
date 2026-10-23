// One-time, reproducible extraction of the legacy prototype's data tables (KM-016/KM-057/KM-058 seed).
// The WORDS and NQ literals are pure data; they are evaluated in an empty vm context (no globals, no DOM).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const args = process.argv.slice(2);
const force = args.includes("--force");
const src = args.find((a) => !a.startsWith("--")) ?? "legacy/Kalimah_Maze_WordGate.html";
const OUT = ["src/content/data/legacy-lexicon.json", "src/content/data/legacy-nahwu.json"];
// Reviewers and editors will change these files later; never clobber them by accident.
if (!force && OUT.some(existsSync)) {
  console.error("Refusing to overwrite existing content files. Re-run with --force only before any review edits exist.");
  process.exit(2);
}
const html = readFileSync(src, "utf8");
const sha = createHash("sha256").update(html).digest("hex");

function literal(name, open, close) {
  const start = html.indexOf(`const ${name}=`);
  if (start < 0) throw new Error(`const ${name}= not found`);
  let i = html.indexOf(open, start);
  // balanced-bracket scan that respects string literals
  let depth = 0, q = null;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (q) { if (c === "\\") j++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return html.slice(i, j + 1);
  }
  throw new Error(`unbalanced literal for ${name}`);
}

const run = (code) => vm.runInNewContext(`(${code})`, Object.create(null), { timeout: 1000 });
const rawWords = run(literal("WORDS", "[", "]"));
const rawNq = run(literal("NQ", "[", "]"));

const provenance = {
  kind: "legacy-prototype",
  file: "legacy/Kalimah_Maze_WordGate.html",
  sha256: sha,
  note: "Authored in the prototype; no bibliographic source is recorded there. Not independently verified.",
};
const review = { status: "pending_review", reviewedBy: null, reviewedOn: null, evidence: null, notes: [], corrections: [], disputes: [] };

// Stable IDs are assigned ONCE here and then frozen in the JSON; glosses may be corrected by reviewers without changing IDs.
const slug = (g) => g.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const lexicon = rawWords.map(([cat, ar, gloss], i) => ({
  newId: `lex-${slug(gloss)}`, legacyId: `w${i}`, zone: cat, ar, id: gloss, provenance, review,
}));
if (new Set(lexicon.map((e) => e.newId)).size !== lexicon.length) throw new Error("duplicate generated lexicon IDs");
const nahwu = rawNq.map((q) => ({
  newId: `nq-${q.id}`, legacyId: q.id, tier: q.tier, topic: q.topic, ar: q.ar, prompt: q.q, options: q.o, answer: q.a, rationale: q.why, provenance, review,
}));

mkdirSync("src/content/data", { recursive: true });
writeFileSync(OUT[0], JSON.stringify({ source: provenance, entries: lexicon }, null, 2) + "\n");
writeFileSync(OUT[1], JSON.stringify({ source: provenance, entries: nahwu }, null, 2) + "\n");
console.log(`legacy sha256 ${sha}\nlexicon ${lexicon.length}, nahwu ${nahwu.length}`);
