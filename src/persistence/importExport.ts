/** JSON export/import fallback (works when the prototype's origin/browser storage cannot be reached). */
import { SAVE_KEY, canonical, isObj, migrate, sanitize, type KeyValueStore, type SaveData } from "./save";
import { commitSave, importLegacyText, type Dropped, type MergeSummary } from "./legacyMigration";

export const EXPORT_FORMAT = "kalimah-maze-save";
export const EXPORT_VERSION = 1;
/** Hostile or accidental huge pastes are refused before parsing. */
export const MAX_IMPORT_CHARS = 2_000_000;
export const PRE_IMPORT_BACKUP_KEY = `${SAVE_KEY}.pre-import`;

export function exportSave(data: SaveData, now: Date = new Date()): string {
  return JSON.stringify({ format: EXPORT_FORMAT, exportVersion: EXPORT_VERSION, exportedAt: now.toISOString(), save: data }, null, 2);
}

export type FileImportResult =
  | { status: "restored" }
  | { status: "legacy-imported"; summary: MergeSummary; dropped: Dropped[] }
  | { status: "already-imported" }
  | { status: "unusable"; reason: string }
  | { status: "failed"; reason: string };

/**
 * Accepts, in order of detection: (1) a Kalimah Maze export envelope, (2) a bare new-format save, (3) the raw prototype blob
 * (`localStorage.getItem('kalimah-maze-v1')`). Restoring (1)/(2) replaces the current save but first keeps its previous bytes
 * under `kalimah-maze.save.pre-import`. The legacy path merges and never replaces.
 */
export function importFromText(store: KeyValueStore, text: string, source: "file" | "paste", now: Date = new Date()): FileImportResult {
  if (text.length > MAX_IMPORT_CHARS) return { status: "unusable", reason: "file is too large to be a save" };
  let raw: unknown;
  try { raw = JSON.parse(text.replace(/^\uFEFF/, "")); } catch { return { status: "unusable", reason: "not valid JSON" }; }
  if (!isObj(raw)) return { status: "unusable", reason: "not a save object" };

  let candidate: Record<string, unknown> | null = null;
  if (raw.format === EXPORT_FORMAT) {
    if (raw.exportVersion !== EXPORT_VERSION) return { status: "unusable", reason: `unsupported export version ${JSON.stringify(raw.exportVersion)}` };
    if (!isObj(raw.save)) return { status: "unusable", reason: "export has no save data" };
    candidate = raw.save;
  } else if (typeof raw.version === "number" && isObj(raw.settings)) {
    candidate = raw;
  }

  if (candidate) {
    const migrated = migrate(candidate);
    if (!migrated) return { status: "unusable", reason: "save version is unknown or newer than this game" };
    const data = sanitize(migrated);
    let previous: string | null = null;
    try { previous = store.getItem(SAVE_KEY); } catch { /* treat as no previous save */ }
    if (previous !== null) { try { store.setItem(PRE_IMPORT_BACKUP_KEY, previous); } catch { return { status: "failed", reason: "could not back up the current save first" }; } }
    const res = commitSave(store, data);
    return res.ok ? { status: "restored" } : { status: "failed", reason: res.reason };
  }

  if (raw.v === 1 || raw.v === 2) {
    const r = importLegacyText(store, text.replace(/^\uFEFF/, ""), source);
    if (r.status === "imported") return { status: "legacy-imported", summary: r.summary, dropped: r.dropped };
    if (r.status === "absent") return { status: "unusable", reason: "empty file" };
    return r;
  }
  return { status: "unusable", reason: "not recognised as a Kalimah Maze save or a prototype save" };
}

/** True if the two saves are identical after validation (used by tests and by export round-trip checks). */
export const sameSave = (a: SaveData, b: SaveData): boolean => canonical(a) === canonical(b);
