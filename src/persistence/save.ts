import type { QuestProgress } from "../quests/evaluator";

export const SAVE_VERSION = 1;
export const SAVE_KEY = "kalimah-maze.save";

export interface Settings {
  arabicTextScale: number; // 0.8–1.6
  showTranslation: boolean;
  leftHanded: boolean;
  controlScheme: "joystick" | "dpad";
  joystickSize: number; // 0.7–1.4
  joystickOpacity: number; // 0.2–1
  masterVolume: number; musicVolume: number; sfxVolume: number; // 0–1
  reducedMotion: boolean;
  screenShake: boolean;
  difficulty: "gentle" | "standard" | "hard";
}

export interface SaveData {
  version: number;
  settings: Settings;
  campaign: { stageId: string; checkpoint: string | null; completedStages: string[] };
  quests: Record<string, QuestProgress>;
  lexicon: Record<string, { state: "discovered" | "practised" | "reverse" | "contextual" | "mastered"; box: number; due: number }>;
}

export const defaultSettings = (reducedMotionPref = false): Settings => ({
  arabicTextScale: 1, showTranslation: true, leftHanded: false, controlScheme: "joystick",
  joystickSize: 1, joystickOpacity: 0.6, masterVolume: 0.8, musicVolume: 0.7, sfxVolume: 0.8,
  reducedMotion: reducedMotionPref, screenShake: !reducedMotionPref, difficulty: "standard",
});

export const defaultSave = (reducedMotionPref = false): SaveData => ({
  version: SAVE_VERSION,
  settings: defaultSettings(reducedMotionPref),
  campaign: { stageId: "stage1-morning-market", checkpoint: null, completedStages: [] },
  quests: {},
  lexicon: {},
});

export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] upgrades version n -> n+1. Legacy-prototype import would be registered here once its schema is supplied. */
export const MIGRATIONS: Record<number, Migration> = {};

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const clamp = (n: unknown, lo: number, hi: number, d: number): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

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

/** Field-by-field validation: any bad field falls back to its default instead of crashing or trusting data. */
export function sanitize(raw: Record<string, unknown>, reducedMotionPref = false): SaveData {
  const d = defaultSave(reducedMotionPref);
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    arabicTextScale: clamp(s.arabicTextScale, 0.8, 1.6, d.settings.arabicTextScale),
    showTranslation: bool(s.showTranslation, d.settings.showTranslation),
    leftHanded: bool(s.leftHanded, d.settings.leftHanded),
    controlScheme: s.controlScheme === "dpad" ? "dpad" : "joystick",
    joystickSize: clamp(s.joystickSize, 0.7, 1.4, d.settings.joystickSize),
    joystickOpacity: clamp(s.joystickOpacity, 0.2, 1, d.settings.joystickOpacity),
    masterVolume: clamp(s.masterVolume, 0, 1, d.settings.masterVolume),
    musicVolume: clamp(s.musicVolume, 0, 1, d.settings.musicVolume),
    sfxVolume: clamp(s.sfxVolume, 0, 1, d.settings.sfxVolume),
    reducedMotion: bool(s.reducedMotion, d.settings.reducedMotion),
    screenShake: bool(s.screenShake, d.settings.screenShake),
    difficulty: s.difficulty === "gentle" || s.difficulty === "hard" ? s.difficulty : "standard",
  };
  const c = isObj(raw.campaign) ? raw.campaign : {};
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
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
  const states = ["discovered", "practised", "reverse", "contextual", "mastered"] as const;
  if (isObj(raw.lexicon)) for (const [id, e] of Object.entries(raw.lexicon)) {
    if (!isObj(e)) continue;
    const st = states.find((x) => x === e.state);
    if (st) lexicon[id] = { state: st, box: Math.round(clamp(e.box, 0, 5, 0)), due: clamp(e.due, 0, Number.MAX_SAFE_INTEGER, 0) };
  }
  return { version: SAVE_VERSION, settings, campaign, quests, lexicon };
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

/** The UI must confirm before calling this (KM-016). */
export function resetSave(store: KeyValueStore): void {
  try { store.removeItem(SAVE_KEY); store.removeItem(`${SAVE_KEY}.corrupt`); } catch { /* ignore */ }
}
