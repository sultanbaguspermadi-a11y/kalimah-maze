import type { QuestProgress } from "../quests/evaluator";

export const SAVE_VERSION = 2;
export const SAVE_KEY = "kalimah-maze.save";

export type ControlScheme = "joystick" | "dpad" | "swipe" | "off";
export type ThemePref = "auto" | "light" | "dark";
export type Difficulty = "gentle" | "standard" | "hard";

export interface Settings {
  language: "id" | "en";
  arabicTextScale: number; // 0.8–1.6
  showTranslation: boolean;
  leftHanded: boolean;
  controlScheme: ControlScheme;
  joystickSize: number; // 0.7–1.4
  joystickOpacity: number; // 0.2–1
  masterVolume: number; musicVolume: number; sfxVolume: number; // 0–1
  muted: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  theme: ThemePref;
  reducedMotion: boolean;
  screenShake: boolean;
  difficulty: Difficulty;
}

export type LexState = "discovered" | "practised" | "reverse" | "contextual" | "mastered";
export const LEX_STATES: readonly LexState[] = ["discovered", "practised", "reverse", "contextual", "mastered"];

/** Per-word answer statistics (carried over from the prototype; also the basis for spaced review). */
export interface LexStats {
  ok: number;
  no: number;
  /** Bit 1 = Arabic→Indonesian recalled, bit 2 = Indonesian→Arabic recalled. */
  dirs: number;
  /** Ids of the most recent credited rounds (max 6). */
  rounds: string[];
  /** Epoch ms of the last credited answer. */
  last: number;
}
export interface NahwuStats { ok: number; no: number; last: number }

export interface ImportRecord {
  sourceHash: string;
  importedAt: string; // ISO timestamp
  legacyVersion: number;
  source: "localStorage" | "file" | "paste";
}

/** Data from the prototype that has no equivalent in the new game; preserved verbatim, not interpreted. */
export interface LegacyBlock {
  imports: ImportRecord[];
  bestScores: Record<string, number>; // "<difficulty>/<mode>" -> score
  preferences: { difficulty: string | null; mode: string | null; zoneTheme: string | null };
  /** Prototype "discovered words" that were also in its lexicon table, as NEW lexicon ids. */
  discovered: string[];
  /** New lexicon ids whose prototype stage was "Mastered" (mapped conservatively; see docs/LEGACY_MIGRATION.md). */
  legacyMastered: string[];
}

export interface SaveData {
  version: number;
  settings: Settings;
  campaign: { stageId: string; checkpoint: string | null; completedStages: string[] };
  quests: Record<string, QuestProgress>;
  lexicon: Record<string, { state: LexState; box: number; due: number }>;
  lexiconStats: Record<string, LexStats>;
  nahwuStats: Record<string, NahwuStats>;
  legacy: LegacyBlock | null;
}

export const defaultSettings = (reducedMotionPref = false): Settings => ({
  language: "id", arabicTextScale: 1, showTranslation: true, leftHanded: false, controlScheme: "joystick",
  joystickSize: 1, joystickOpacity: 0.6, masterVolume: 0.8, musicVolume: 0.7, sfxVolume: 0.8,
  muted: false, musicEnabled: true, sfxEnabled: true, theme: "auto",
  reducedMotion: reducedMotionPref, screenShake: !reducedMotionPref, difficulty: "standard",
});

export const defaultSave = (reducedMotionPref = false): SaveData => ({
  version: SAVE_VERSION,
  settings: defaultSettings(reducedMotionPref),
  campaign: { stageId: "stage1-morning-market", checkpoint: null, completedStages: [] },
  quests: {},
  lexicon: {},
  lexiconStats: {},
  nahwuStats: {},
  legacy: null,
});

export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] upgrades version n -> n+1. The legacy prototype is NOT a version here: it is imported by `legacyMigration.ts`. */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 (foundation dev builds) -> v2: adds statistics + legacy block; settings gain fields that `sanitize` defaults.
  1: (o) => ({ ...o, lexiconStats: {}, nahwuStats: {}, legacy: null }),
};

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const clamp = (n: unknown, lo: number, hi: number, d: number): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const nonNegInt = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(v))) : 0);
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => allowed.find((a) => a === v) ?? d;

export function migrate(raw: Record<string, unknown>, migrations: Record<number, Migration> = MIGRATIONS, target = SAVE_VERSION): Record<string, unknown> | null {
  let v = typeof raw.version === "number" ? raw.version : NaN;
  if (!Number.isInteger(v) || v < 0 || v > target) return null; // unknown/future versions are not guessed at
  let cur = raw;
  while (v < target) {
    const step = migrations[v];
    if (!step) return null;
    cur = { ...step(cur), version: v + 1 };
    v++;
  }
  return cur;
}

export function sanitizeSettings(s: Record<string, unknown>, reducedMotionPref = false): Settings {
  const d = defaultSettings(reducedMotionPref);
  return {
    language: pick(s.language, ["id", "en"], d.language),
    arabicTextScale: clamp(s.arabicTextScale, 0.8, 1.6, d.arabicTextScale),
    showTranslation: bool(s.showTranslation, d.showTranslation),
    leftHanded: bool(s.leftHanded, d.leftHanded),
    controlScheme: pick(s.controlScheme, ["joystick", "dpad", "swipe", "off"], d.controlScheme),
    joystickSize: clamp(s.joystickSize, 0.7, 1.4, d.joystickSize),
    joystickOpacity: clamp(s.joystickOpacity, 0.2, 1, d.joystickOpacity),
    masterVolume: clamp(s.masterVolume, 0, 1, d.masterVolume),
    musicVolume: clamp(s.musicVolume, 0, 1, d.musicVolume),
    sfxVolume: clamp(s.sfxVolume, 0, 1, d.sfxVolume),
    muted: bool(s.muted, d.muted),
    musicEnabled: bool(s.musicEnabled, d.musicEnabled),
    sfxEnabled: bool(s.sfxEnabled, d.sfxEnabled),
    theme: pick(s.theme, ["auto", "light", "dark"], d.theme),
    reducedMotion: bool(s.reducedMotion, d.reducedMotion),
    screenShake: bool(s.screenShake, d.screenShake),
    difficulty: pick(s.difficulty, ["gentle", "standard", "hard"], d.difficulty),
  };
}

export function sanitizeLexStats(e: Record<string, unknown>): LexStats {
  return {
    ok: nonNegInt(e.ok), no: nonNegInt(e.no), dirs: nonNegInt(e.dirs) & 3,
    rounds: strArr(e.rounds).slice(-6), last: nonNegInt(e.last),
  };
}

/** Field-by-field validation: any bad field falls back to its default instead of crashing or trusting data. */
export function sanitize(raw: Record<string, unknown>, reducedMotionPref = false): SaveData {
  const d = defaultSave(reducedMotionPref);
  const c = isObj(raw.campaign) ? raw.campaign : {};
  const campaign = {
    stageId: typeof c.stageId === "string" && c.stageId ? c.stageId : d.campaign.stageId,
    checkpoint: typeof c.checkpoint === "string" ? c.checkpoint : null,
    completedStages: [...new Set(strArr(c.completedStages))],
  };
  const quests: SaveData["quests"] = {};
  if (isObj(raw.quests)) for (const [id, q] of Object.entries(raw.quests)) {
    if (isObj(q)) quests[id] = { completed: strArr(q.completed), flags: strArr(q.flags) };
  }
  const lexicon: SaveData["lexicon"] = {};
  if (isObj(raw.lexicon)) for (const [id, e] of Object.entries(raw.lexicon)) {
    if (!isObj(e)) continue;
    const st = LEX_STATES.find((x) => x === e.state);
    if (st) lexicon[id] = { state: st, box: Math.round(clamp(e.box, 0, 5, 0)), due: clamp(e.due, 0, Number.MAX_SAFE_INTEGER, 0) };
  }
  const lexiconStats: SaveData["lexiconStats"] = {};
  if (isObj(raw.lexiconStats)) for (const [id, e] of Object.entries(raw.lexiconStats)) if (isObj(e)) lexiconStats[id] = sanitizeLexStats(e);
  const nahwuStats: SaveData["nahwuStats"] = {};
  if (isObj(raw.nahwuStats)) for (const [id, e] of Object.entries(raw.nahwuStats)) {
    if (isObj(e)) nahwuStats[id] = { ok: nonNegInt(e.ok), no: nonNegInt(e.no), last: nonNegInt(e.last) };
  }
  return {
    version: SAVE_VERSION,
    settings: sanitizeSettings(isObj(raw.settings) ? raw.settings : {}, reducedMotionPref),
    campaign, quests, lexicon, lexiconStats, nahwuStats,
    legacy: sanitizeLegacy(raw.legacy),
  };
}

function sanitizeLegacy(v: unknown): LegacyBlock | null {
  if (!isObj(v)) return null;
  const imports: ImportRecord[] = [];
  if (Array.isArray(v.imports)) for (const r of v.imports.slice(-20)) {
    if (!isObj(r) || typeof r.sourceHash !== "string" || typeof r.importedAt !== "string") continue;
    imports.push({
      sourceHash: r.sourceHash, importedAt: r.importedAt,
      legacyVersion: nonNegInt(r.legacyVersion),
      source: pick(r.source, ["localStorage", "file", "paste"], "localStorage"),
    });
  }
  const bestScores: Record<string, number> = {};
  if (isObj(v.bestScores)) for (const [k, n] of Object.entries(v.bestScores)) if (typeof n === "number" && Number.isFinite(n) && n >= 0) bestScores[k] = Math.trunc(n);
  const p = isObj(v.preferences) ? v.preferences : {};
  const s = (x: unknown): string | null => (typeof x === "string" ? x : null);
  return {
    imports, bestScores,
    preferences: { difficulty: s(p.difficulty), mode: s(p.mode), zoneTheme: s(p.zoneTheme) },
    discovered: [...new Set(strArr(v.discovered))],
    legacyMastered: [...new Set(strArr(v.legacyMastered))],
  };
}

export type LoadResult = { data: SaveData; status: "new" | "loaded" | "recovered" };

export function loadSave(store: KeyValueStore, reducedMotionPref = false): LoadResult {
  let text: string | null;
  try { text = store.getItem(SAVE_KEY); } catch { return { data: defaultSave(reducedMotionPref), status: "recovered" }; }
  if (text === null) return { data: defaultSave(reducedMotionPref), status: "new" };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isObj(parsed)) throw new Error("not an object");
    const migrated = migrate(parsed);
    if (!migrated) throw new Error("unsupported version");
    return { data: sanitize(migrated, reducedMotionPref), status: "loaded" };
  } catch {
    // Keep the unreadable blob under a backup key so a user/developer can inspect it; never silently destroy it.
    try { store.setItem(`${SAVE_KEY}.corrupt`, text); } catch { /* storage full/unavailable */ }
    return { data: defaultSave(reducedMotionPref), status: "recovered" };
  }
}

export function writeSave(store: KeyValueStore, data: SaveData): boolean {
  try { store.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

/** The UI must confirm before calling this (KM-016). Does not touch the legacy prototype's key. */
export function resetSave(store: KeyValueStore): void {
  try { store.removeItem(SAVE_KEY); store.removeItem(`${SAVE_KEY}.corrupt`); } catch { /* ignore */ }
}

/** Key-order-independent serialisation, for equality checks of validated saves. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}
