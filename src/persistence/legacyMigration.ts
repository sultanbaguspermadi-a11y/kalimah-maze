/**
 * Import of the prototype's save (`Kalimah_Maze_WordGate.html`, localStorage key `kalimah-maze-v1`, schema v:1 | v:2).
 * Guarantees (see docs/LEGACY_MIGRATION.md):
 *  - the legacy key is only ever READ here; it is never written or deleted by import;
 *  - result is validated and read back before the import is reported as successful, with rollback on failure;
 *  - importing the same legacy data twice is a no-op, and the merge itself is idempotent.
 */
import lexData from "../content/data/legacy-lexicon.json";
import nahwuData from "../content/data/legacy-nahwu.json";
import {
  LEX_STATES, SAVE_KEY, canonical, clamp, isObj, loadSave, sanitize, writeSave,
  type ImportRecord, type KeyValueStore, type LexState, type LexStats, type NahwuStats, type SaveData, type Settings,
} from "./save";

export const LEGACY_KEY = "kalimah-maze-v1";
/** Console one-liner for users who must move data between origins/browsers by hand. */
export const LEGACY_EXPORT_SNIPPET = `copy(localStorage.getItem('${LEGACY_KEY}'))`;

/** Frozen mapping prototype id -> stable new id (assigned once by tools/extract-legacy-content.mjs). */
export const LEGACY_WORD_IDS: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(lexData.entries.map((e) => [e.legacyId, e.newId])));
export const LEGACY_NAHWU_IDS: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(nahwuData.entries.map((e) => [e.legacyId, e.newId])));

const DIFFS = ["chill", "normal", "tricky", "hard", "hardcore"] as const;
const MODES = ["adv", "hunt", "nahwu"] as const;
const ZONES = ["school", "market", "tech", "daily"] as const;
const BEST_KEY = /^(chill|normal|tricky|hard|hardcore)\/(adv|hunt|nahwu)$/;

export interface LegacySettingsPartial {
  lang?: "id" | "en"; vm?: number; vmu?: number; vs?: number; mt?: boolean; snd?: boolean; mus?: boolean; rm?: boolean;
  ar?: 0 | 1 | 2; ctl?: "stick" | "dpad" | "swipe" | "off"; th?: "auto" | "light" | "dark"; tr?: boolean; lh?: boolean;
}
export interface LegacyData {
  version: 1 | 2;
  lex: Record<string, LexStats>; // keyed by LEGACY id
  nq: Record<string, NahwuStats>; // keyed by LEGACY id
  words: string[]; // discovered, LEGACY ids
  best: Record<string, number>;
  settings: LegacySettingsPartial; // only keys that were present AND valid
  difficulty: string | null; mode: string | null; zone: string | null;
}
export interface Dropped { kind: "lexicon" | "nahwu" | "word" | "best" | "setting" | "field"; id: string; reason: string }
export interface ParseReport { dropped: Dropped[] }

export type LegacyParse =
  | { status: "absent" }
  | { status: "unusable"; reason: string }
  | { status: "ok"; data: LegacyData; report: ParseReport; sourceHash: string };

/** FNV-1a (32-bit) over UTF-16 units: change detection only, NOT a security hash. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${text.length}-${h.toString(16).padStart(8, "0")}`;
}

/** Mirrors the prototype's `+x|0` counters, clamped at 0, but without int32 wrap-around. */
function legacyInt(v: unknown): number {
  const n = typeof v === "number" || typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(2147483647, Math.trunc(n))) : 0;
}
/** Mirrors the prototype's `+x||0` for timestamps (epoch ms; NOT int32-limited). */
function legacyTime(v: unknown): number {
  const n = typeof v === "number" || typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, n)) : 0;
}
const flag = (v: unknown): boolean | undefined => (v === 0 || v === false ? false : v === 1 || v === true ? true : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => list.find((x) => x === v);

export function parseLegacy(text: string | null): LegacyParse {
  if (text === null || text === "") return { status: "absent" };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { status: "unusable", reason: "legacy data is not valid JSON" }; }
  if (!isObj(raw)) return { status: "unusable", reason: "legacy data is not an object" };
  if (raw.v !== 1 && raw.v !== 2) return { status: "unusable", reason: `unsupported legacy version (${JSON.stringify(raw.v) ?? "missing"}); only v:1 and v:2 are known` };

  const dropped: Dropped[] = [];
  const drop = (kind: Dropped["kind"], id: string, reason: string): void => { dropped.push({ kind, id, reason }); };

  const lex: LegacyData["lex"] = {};
  if (isObj(raw.lex)) for (const [id, e] of Object.entries(raw.lex)) {
    if (!(id in LEGACY_WORD_IDS)) { drop("lexicon", id, "unknown word id (the prototype also discards these)"); continue; }
    if (!isObj(e)) { drop("lexicon", id, "entry is not an object"); continue; }
    lex[id] = {
      ok: legacyInt(e.ok), no: legacyInt(e.no), dirs: legacyInt(e.dirs) & 3,
      rounds: (Array.isArray(e.rounds) ? e.rounds.filter((x): x is string => typeof x === "string") : []).slice(-6),
      last: legacyTime(e.last),
    };
  } else if (raw.lex !== undefined) drop("field", "lex", "not an object");

  const words: string[] = [];
  if (Array.isArray(raw.words)) for (const w of raw.words) {
    if (typeof w === "string" && w in LEGACY_WORD_IDS) { if (!words.includes(w)) words.push(w); } else drop("word", String(w), "unknown word id");
  } else if (raw.words !== undefined) drop("field", "words", "not an array");

  const nq: LegacyData["nq"] = {};
  if (isObj(raw.nq)) for (const [id, e] of Object.entries(raw.nq)) {
    if (!(id in LEGACY_NAHWU_IDS)) { drop("nahwu", id, "unknown question id"); continue; }
    if (!isObj(e)) { drop("nahwu", id, "entry is not an object"); continue; }
    nq[id] = { ok: legacyInt(e.ok), no: legacyInt(e.no), last: legacyTime(e.last) };
  } else if (raw.nq !== undefined) drop("field", "nq", "not an object");

  const best: LegacyData["best"] = {};
  if (isObj(raw.best)) for (const [k, n] of Object.entries(raw.best)) {
    if (BEST_KEY.test(k) && typeof n === "number" && Number.isFinite(n) && n >= 0) best[k] = Math.trunc(n);
    else drop("best", k, "unrecognised key or non-numeric/negative score");
  } else if (raw.best !== undefined) drop("field", "best", "not an object");

  const settings: LegacySettingsPartial = {};
  const s = isObj(raw.set) ? raw.set : {};
  if (raw.set !== undefined && !isObj(raw.set)) drop("field", "set", "not an object");
  const put = <K extends keyof LegacySettingsPartial>(k: K, v: LegacySettingsPartial[K] | undefined): void => {
    if (v !== undefined) settings[k] = v; else if (k in s) drop("setting", k, "invalid value");
  };
  put("lang", oneOf(s.lang, ["id", "en"] as const));
  for (const k of ["vm", "vmu", "vs"] as const) put(k, typeof s[k] === "number" && Number.isFinite(s[k]) ? clamp(s[k], 0, 100, 80) : undefined);
  for (const k of ["mt", "snd", "mus", "rm", "tr", "lh"] as const) put(k, flag(s[k]));
  put("ar", s.ar === 0 || s.ar === 1 || s.ar === 2 ? s.ar : undefined);
  put("ctl", oneOf(s.ctl, ["stick", "dpad", "swipe", "off"] as const));
  put("th", oneOf(s.th, ["auto", "light", "dark"] as const));

  const data: LegacyData = {
    version: raw.v, lex, nq, words, best, settings,
    difficulty: oneOf(raw.diff, DIFFS) ?? null, mode: oneOf(raw.mode, MODES) ?? null, zone: oneOf(raw.theme, ZONES) ?? null,
  };
  return { status: "ok", data, report: { dropped }, sourceHash: hashText(text) };
}

// ---- mapping ----

/** Prototype stage: 0 undiscovered, 1 discovered, 2 recall, 3 reverse, 4 mastered (same rule as the prototype's `stOf`). */
export function legacyStage(e: LexStats): 1 | 2 | 3 | 4 {
  return e.rounds.length >= 3 && e.dirs === 3 ? 4 : e.dirs === 3 ? 3 : e.ok > 0 ? 2 : 1;
}
/**
 * Prototype "Mastered" = 3 credited rounds + both directions, with credits only 5 minutes apart. The new game requires
 * spaced reviews on its own schedule, so it is mapped CONSERVATIVELY to "reverse" and remembered in `legacy.legacyMastered`.
 */
const STAGE_TO_STATE: Record<1 | 2 | 3 | 4, LexState> = { 1: "discovered", 2: "practised", 3: "reverse", 4: "reverse" };
const rank = (s: LexState): number => LEX_STATES.indexOf(s);

const DIFFICULTY_MAP: Record<(typeof DIFFS)[number], Settings["difficulty"]> = { chill: "gentle", normal: "standard", tricky: "standard", hard: "hard", hardcore: "hard" };
const ARABIC_SCALE: Record<0 | 1 | 2, number> = { 0: 0.85, 1: 1, 2: 1.3 };

export function applyLegacySettings(base: Settings, p: LegacySettingsPartial, difficulty: string | null): { settings: Settings; applied: string[] } {
  const s: Settings = { ...base };
  const applied: string[] = [];
  const set = <K extends keyof Settings>(k: K, v: Settings[K], from: string): void => { s[k] = v; applied.push(from); };
  if (p.lang !== undefined) set("language", p.lang, "lang");
  if (p.vm !== undefined) set("masterVolume", p.vm / 100, "vm");
  if (p.vmu !== undefined) set("musicVolume", p.vmu / 100, "vmu");
  if (p.vs !== undefined) set("sfxVolume", p.vs / 100, "vs");
  if (p.mt !== undefined) set("muted", p.mt, "mt");
  if (p.snd !== undefined) set("sfxEnabled", p.snd, "snd");
  if (p.mus !== undefined) set("musicEnabled", p.mus, "mus");
  if (p.rm !== undefined) { set("reducedMotion", p.rm, "rm"); if (p.rm) s.screenShake = false; }
  if (p.ar !== undefined) set("arabicTextScale", ARABIC_SCALE[p.ar], "ar");
  if (p.ctl !== undefined) set("controlScheme", p.ctl === "stick" ? "joystick" : p.ctl, "ctl");
  if (p.th !== undefined) set("theme", p.th, "th");
  if (p.tr !== undefined) set("showTranslation", p.tr, "tr");
  if (p.lh !== undefined) set("leftHanded", p.lh, "lh");
  const d = oneOf(difficulty, DIFFS);
  if (d) set("difficulty", DIFFICULTY_MAP[d], "diff");
  return { settings: s, applied };
}

const mergeLex = (a: LexStats | undefined, b: LexStats): LexStats => !a ? { ...b, rounds: [...b.rounds] } : {
  ok: Math.max(a.ok, b.ok), no: Math.max(a.no, b.no), dirs: a.dirs | b.dirs,
  rounds: [...a.rounds, ...b.rounds.filter((r) => !a.rounds.includes(r))].slice(-6), last: Math.max(a.last, b.last),
};
const mergeNq = (a: NahwuStats | undefined, b: NahwuStats): NahwuStats => !a ? { ...b } : { ok: Math.max(a.ok, b.ok), no: Math.max(a.no, b.no), last: Math.max(a.last, b.last) };

export interface MergeSummary { lexiconEntries: number; discoveredWords: number; nahwuEntries: number; bestScores: number; settingsApplied: string[] }
export interface MergeResult { data: SaveData; outcome: "imported" | "already-imported"; summary: MergeSummary }

/**
 * Pure merge of prototype data into a save. Counters merge by max, direction bits by OR, recent rounds by ordered union:
 * all idempotent, so merging the same data again changes nothing. Existing new-game progress is never downgraded and,
 * after the first import, the player's current settings are never overwritten.
 */
export function mergeLegacy(save: SaveData, legacy: LegacyData, sourceHash: string, source: ImportRecord["source"], now: Date): MergeResult {
  const empty: MergeSummary = { lexiconEntries: 0, discoveredWords: 0, nahwuEntries: 0, bestScores: 0, settingsApplied: [] };
  if (save.legacy?.imports.some((i) => i.sourceHash === sourceHash)) return { data: save, outcome: "already-imported", summary: empty };

  const out: SaveData = structuredClone(save);
  const first = out.legacy === null;
  const block = out.legacy ?? { imports: [], bestScores: {}, preferences: { difficulty: null, mode: null, zoneTheme: null }, discovered: [], legacyMastered: [] };

  const legacyIds = new Set([...Object.keys(legacy.lex), ...legacy.words]);
  for (const lid of legacyIds) {
    const nid = LEGACY_WORD_IDS[lid];
    if (!nid) continue;
    const stats = mergeLex(out.lexiconStats[nid], legacy.lex[lid] ?? { ok: 0, no: 0, dirs: 0, rounds: [], last: 0 });
    out.lexiconStats[nid] = stats;
    const stage = legacyStage(stats);
    const derived = STAGE_TO_STATE[stage];
    const existing = out.lexicon[nid];
    if (!existing || rank(existing.state) < rank(derived)) out.lexicon[nid] = { state: derived, box: Math.min(5, stats.rounds.length), due: stats.last };
    if (legacy.words.includes(lid) && !block.discovered.includes(nid)) block.discovered.push(nid);
    if (stage === 4 && !block.legacyMastered.includes(nid)) block.legacyMastered.push(nid);
  }
  for (const [lid, e] of Object.entries(legacy.nq)) {
    const nid = LEGACY_NAHWU_IDS[lid];
    if (nid) out.nahwuStats[nid] = mergeNq(out.nahwuStats[nid], e);
  }
  for (const [k, n] of Object.entries(legacy.best)) block.bestScores[k] = Math.max(block.bestScores[k] ?? 0, n);

  let settingsApplied: string[] = [];
  if (first) {
    const r = applyLegacySettings(out.settings, legacy.settings, legacy.difficulty);
    out.settings = r.settings; settingsApplied = r.applied;
    block.preferences = { difficulty: legacy.difficulty, mode: legacy.mode, zoneTheme: legacy.zone };
  }
  block.imports = [...block.imports, { sourceHash, importedAt: now.toISOString(), legacyVersion: legacy.version, source }].slice(-20);
  block.discovered.sort(); block.legacyMastered.sort();
  out.legacy = block;

  return {
    data: out, outcome: "imported",
    summary: { lexiconEntries: Object.keys(legacy.lex).length, discoveredWords: legacy.words.length, nahwuEntries: Object.keys(legacy.nq).length, bestScores: Object.keys(legacy.best).length, settingsApplied },
  };
}

// ---- orchestration (the only place that touches storage) ----

export type ImportOutcome =
  | { status: "absent" }
  | { status: "unusable"; reason: string }
  | { status: "already-imported" }
  | { status: "imported"; summary: MergeSummary; dropped: Dropped[] }
  | { status: "failed"; reason: string };

const safeGet = (store: KeyValueStore, key: string): string | null => { try { return store.getItem(key); } catch { return null; } };

/** Validates -> writes -> reads back -> verifies. Rolls the new save back to its previous bytes on any failure. */
export function commitSave(store: KeyValueStore, data: SaveData): { ok: true } | { ok: false; reason: string } {
  let roundTrip: SaveData;
  try { roundTrip = sanitize(JSON.parse(JSON.stringify(data)) as Record<string, unknown>); } catch { return { ok: false, reason: "migrated data could not be serialised" }; }
  if (canonical(roundTrip) !== canonical(data)) return { ok: false, reason: "migrated data failed validation" };

  const previous = safeGet(store, SAVE_KEY);
  const rollback = (): void => {
    try { if (previous === null) store.removeItem(SAVE_KEY); else store.setItem(SAVE_KEY, previous); } catch { /* nothing more we can do */ }
  };
  if (!writeSave(store, data)) { rollback(); return { ok: false, reason: "could not write the new save (storage full or blocked)" }; }
  const back = safeGet(store, SAVE_KEY);
  let ok = false;
  try { ok = back !== null && canonical(sanitize(JSON.parse(back) as Record<string, unknown>)) === canonical(data); } catch { ok = false; }
  if (!ok) { rollback(); return { ok: false, reason: "read-back verification failed; previous save restored" }; }
  return { ok: true };
}

export function importLegacyText(store: KeyValueStore, text: string | null, source: ImportRecord["source"], now: Date = new Date()): ImportOutcome {
  const parsed = parseLegacy(text);
  if (parsed.status === "absent") return { status: "absent" };
  if (parsed.status === "unusable") return { status: "unusable", reason: parsed.reason };

  const current = loadSave(store).data; // a corrupt current save is backed up by loadSave and replaced by defaults
  const merged = mergeLegacy(current, parsed.data, parsed.sourceHash, source, now);
  if (merged.outcome === "already-imported") return { status: "already-imported" };
  const res = commitSave(store, merged.data);
  if (!res.ok) return { status: "failed", reason: res.reason };
  return { status: "imported", summary: merged.summary, dropped: parsed.report.dropped };
}

/** Reads (never writes) the legacy key from the CURRENT origin's storage. Other origins/browsers are unreachable: use file import. */
export function importLegacyFromStorage(store: KeyValueStore, now: Date = new Date()): ImportOutcome {
  let text: string | null;
  try { text = store.getItem(LEGACY_KEY); } catch { return { status: "failed", reason: "browser storage is not accessible" }; }
  return importLegacyText(store, text, "localStorage", now);
}

/**
 * Optional explicit clean-up (never called automatically). Removes the legacy key only if the stored new save is valid
 * and records an import of exactly the data that is currently in the legacy key.
 */
export function retireLegacy(store: KeyValueStore): { status: "removed" | "refused" | "absent"; reason?: string } {
  const text = safeGet(store, LEGACY_KEY);
  if (text === null) return { status: "absent" };
  const parsed = parseLegacy(text);
  if (parsed.status !== "ok") return { status: "refused", reason: "legacy data is not a valid prototype save; keeping it" };
  const cur = loadSave(store);
  if (cur.status !== "loaded") return { status: "refused", reason: "new save is missing or unreadable" };
  if (!cur.data.legacy?.imports.some((i) => i.sourceHash === parsed.sourceHash)) return { status: "refused", reason: "legacy data was not imported, or changed after import" };
  try { store.removeItem(LEGACY_KEY); } catch { return { status: "refused", reason: "could not remove legacy key" }; }
  return { status: "removed" };
}

